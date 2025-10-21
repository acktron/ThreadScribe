from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import re
from datetime import datetime
import asyncio
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="ThreadScribe API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini AI (optional)
try:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-pro')
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Google Generative AI not available. Install with: pip install google-generativeai")

# Initialize Hugging Face pipeline for text analysis (optional)
try:
    from transformers import pipeline
    sentiment_analyzer = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment-latest")
    HUGGINGFACE_AVAILABLE = True
except ImportError:
    HUGGINGFACE_AVAILABLE = False
    print("Hugging Face Transformers not available. Install with: pip install transformers torch")

# Pydantic models
class ChatMessage(BaseModel):
    sender: str
    content: str
    timestamp: str
    message_type: str = "text"

class ChatSummary(BaseModel):
    tasks: List[str]
    questions: List[str]
    decisions: List[str]
    key_points: List[str]
    sentiment_analysis: Dict[str, Any]
    participants: List[str]
    summary: str

class ProcessedChat(BaseModel):
    messages: List[ChatMessage]
    summary: ChatSummary
    metadata: Dict[str, Any]

class QueryRequest(BaseModel):
    query: str
    chat_id: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    sources: List[str]
    confidence: float

# Utility functions
def parse_whatsapp_chat(content: str) -> List[ChatMessage]:
    """Parse WhatsApp chat export into structured messages"""
    messages = []
    lines = content.strip().split('\n')
    
    current_message = None
    for line in lines:
        # WhatsApp message pattern: [DD/MM/YYYY, HH:MM:SS] Sender: Message
        pattern = r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}:\d{2}) ([^:]+): (.+)$'
        match = re.match(pattern, line)
        
        if match:
            date, time, sender, content = match.groups()
            timestamp = f"{date} {time}"
            
            # Save previous message if exists
            if current_message:
                messages.append(current_message)
            
            # Create new message
            current_message = ChatMessage(
                sender=sender.strip(),
                content=content.strip(),
                timestamp=timestamp,
                message_type="text"
            )
        elif current_message and line.strip():
            # Continuation of previous message
            current_message.content += f"\n{line.strip()}"
    
    # Add last message
    if current_message:
        messages.append(current_message)
    
    return messages

def extract_structured_content(messages: List[ChatMessage]) -> ChatSummary:
    """Extract tasks, questions, decisions from chat messages"""
    
    # Combine all messages for analysis
    full_text = "\n".join([f"{msg.sender}: {msg.content}" for msg in messages])
    
    # Get participants
    participants = list(set([msg.sender for msg in messages]))
    
    # Sentiment analysis
    sentiments = []
    if HUGGINGFACE_AVAILABLE:
        for msg in messages:
            if len(msg.content) > 10:  # Only analyze substantial messages
                try:
                    sentiment = sentiment_analyzer(msg.content)
                    sentiments.append(sentiment[0])
                except:
                    continue
    
    # Calculate overall sentiment
    sentiment_summary = {
        "positive": len([s for s in sentiments if s['label'] == 'LABEL_2']) if HUGGINGFACE_AVAILABLE else 0,
        "negative": len([s for s in sentiments if s['label'] == 'LABEL_0']) if HUGGINGFACE_AVAILABLE else 0,
        "neutral": len([s for s in sentiments if s['label'] == 'LABEL_1']) if HUGGINGFACE_AVAILABLE else len(messages),
        "total_messages": len(sentiments) if HUGGINGFACE_AVAILABLE else len(messages)
    }
    
    # Use Gemini AI for structured extraction if available
    if GEMINI_AVAILABLE:
        prompt = f"""
        Analyze this WhatsApp chat conversation and extract:
        
        1. TASKS: Specific actionable items or to-dos mentioned
        2. QUESTIONS: Questions that need answers
        3. DECISIONS: Decisions made or pending
        4. KEY_POINTS: Important information or highlights
        5. SUMMARY: A concise summary of the conversation
        
        Chat content:
        {full_text[:4000]}  # Limit to avoid token limits
        
        Return the response in JSON format with these exact keys: tasks, questions, decisions, key_points, summary
        """
        
        try:
            response = model.generate_content(prompt)
            # Parse JSON response
            structured_data = json.loads(response.text)
            
            return ChatSummary(
                tasks=structured_data.get('tasks', []),
                questions=structured_data.get('questions', []),
                decisions=structured_data.get('decisions', []),
                key_points=structured_data.get('key_points', []),
                sentiment_analysis=sentiment_summary,
                participants=participants,
                summary=structured_data.get('summary', '')
            )
        except Exception as e:
            print(f"Gemini AI error: {e}")
    
    # Fallback to basic extraction
    tasks = []
    questions = []
    decisions = []
    key_points = []
    
    # Simple keyword-based extraction
    for msg in messages:
        content = msg.content.lower()
        if any(word in content for word in ['need to', 'should', 'must', 'have to', 'task']):
            tasks.append(msg.content)
        if '?' in msg.content:
            questions.append(msg.content)
        if any(word in content for word in ['decide', 'decision', 'choose', 'pick']):
            decisions.append(msg.content)
        if any(word in content for word in ['important', 'key', 'main', 'primary']):
            key_points.append(msg.content)
    
    return ChatSummary(
        tasks=tasks[:5],  # Limit to 5 items
        questions=questions[:5],
        decisions=decisions[:5],
        key_points=key_points[:5],
        sentiment_analysis=sentiment_summary,
        participants=participants,
        summary=f"Chat analysis completed. Found {len(tasks)} tasks, {len(questions)} questions, and {len(decisions)} decisions."
    )

# API Endpoints
@app.get("/")
async def root():
    return {"message": "ThreadScribe API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/parse-and-summarize", response_model=ProcessedChat)
async def parse_and_summarize(file: UploadFile = File(...)):
    """Parse WhatsApp chat file and return structured summary"""
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Parse messages
        messages = parse_whatsapp_chat(content_str)
        
        if not messages:
            raise HTTPException(status_code=400, detail="No valid messages found in the file")
        
        # Extract structured content
        summary = extract_structured_content(messages)
        
        # Create metadata
        metadata = {
            "total_messages": len(messages),
            "participants": len(summary.participants),
            "date_range": {
                "start": messages[0].timestamp if messages else None,
                "end": messages[-1].timestamp if messages else None
            },
            "processed_at": datetime.now().isoformat()
        }
        
        return ProcessedChat(
            messages=messages,
            summary=summary,
            metadata=metadata
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/api/chat", response_model=QueryResponse)
async def chat_query(request: QueryRequest):
    """Answer questions about chat content using AI"""
    try:
        if GEMINI_AVAILABLE:
            prompt = f"""
            Answer this question about WhatsApp chat analysis: {request.query}
            
            Provide a helpful response based on common chat analysis patterns.
            """
            
            response = model.generate_content(prompt)
            
            return QueryResponse(
                answer=response.text,
                sources=["ThreadScribe Analysis"],
                confidence=0.8
            )
        else:
            # Fallback response
            return QueryResponse(
                answer=f"I understand you're asking: '{request.query}'. This is a basic response since AI features are not fully configured. Please install google-generativeai for enhanced responses.",
                sources=["ThreadScribe Basic Analysis"],
                confidence=0.5
            )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

@app.get("/api/whatsapp/status")
async def whatsapp_status():
    """Check WhatsApp bridge status"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8081/api/status")
            return response.json()
    except:
        return {"connected": False, "error": "WhatsApp bridge not available"}

@app.get("/api/whatsapp/chats")
async def get_whatsapp_chats():
    """Get chats from WhatsApp bridge"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8081/api/chats")
            return response.json()
    except:
        return {"error": "WhatsApp bridge not available"}

@app.get("/api/whatsapp/messages/{chat_id}")
async def get_whatsapp_messages(chat_id: str):
    """Get messages from a specific chat"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://localhost:8081/api/messages?chatId={chat_id}")
            return response.json()
    except:
        return {"error": "WhatsApp bridge not available"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
