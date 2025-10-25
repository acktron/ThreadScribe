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
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"GEMINI_API_KEY loaded: {api_key[:10]}..." if api_key else "GEMINI_API_KEY not found")
    genai.configure(api_key=api_key)
    
    # List available models for debugging (commented out for production)
    # try:
    #     models = genai.list_models()
    #     print("Available models:")
    #     for m in models:
    #         if 'generateContent' in m.supported_generation_methods:
    #             print(f"  - {m.name}")
    # except Exception as e:
    #     print(f"Could not list models: {e}")
    
    model = genai.GenerativeModel('gemini-2.0-flash')
    GEMINI_AVAILABLE = True
    print("Gemini AI configured successfully")
except ImportError:
    GEMINI_AVAILABLE = False
    print("Google Generative AI not available. Install with: pip install google-generativeai")
except Exception as e:
    GEMINI_AVAILABLE = False
    print(f"Error configuring Gemini AI: {e}")

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
    chat_data: Optional[str] = None

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
        # Multiple WhatsApp message patterns to handle different export formats
        patterns = [
            # Pattern 1: DD/MM/YYYY, HH:MM AM/PM - Sender: Message (4-digit year with AM/PM)
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2} [AP]M) - ([^:]+): (.+)$',
            # Pattern 2: DD/MM/YY, HH:MM - Sender: Message (2-digit year without AM/PM)
            r'^(\d{1,2}/\d{1,2}/\d{2}), (\d{1,2}:\d{2}) - ([^:]+): (.+)$',
            # Pattern 3: DD/MM/YYYY, HH:MM - Sender: Message (4-digit year without AM/PM)
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}) - ([^:]+): (.+)$',
            # Pattern 4: DD/MM/YY, HH:MM AM/PM - Sender: Message (2-digit year with AM/PM)
            r'^(\d{1,2}/\d{1,2}/\d{2}), (\d{1,2}:\d{2} [AP]M) - ([^:]+): (.+)$',
            # Pattern 5: [DD/MM/YYYY, HH:MM:SS] Sender: Message
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}:\d{2}) ([^:]+): (.+)$',
            # Pattern 6: [DD/MM/YYYY, HH:MM:SS] Sender: Message (with AM/PM)
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}:\d{2} [AP]M) ([^:]+): (.+)$',
            # Pattern 7: DD/MM/YYYY, HH:MM:SS - Sender: Message
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}:\d{2}) - ([^:]+): (.+)$',
            # Pattern 8: [MM/DD/YYYY, HH:MM:SS] Sender: Message
            r'^(\d{1,2}/\d{1,2}/\d{4}), (\d{1,2}:\d{2}:\d{2}) ([^:]+): (.+)$',
            # Pattern 9: YYYY-MM-DD HH:MM:SS - Sender: Message
            r'^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) - ([^:]+): (.+)$',
            # Pattern 10: Simple format: Sender: Message (fallback)
            r'^([^:]+): (.+)$'
        ]
        
        match = None
        matched_pattern = None
        for i, pattern in enumerate(patterns):
            match = re.match(pattern, line)
            if match:
                matched_pattern = i + 1
                break
        
        if match:
            groups = match.groups()
            
            # Save previous message if exists
            if current_message:
                messages.append(current_message)
            
            if len(groups) == 4:
                # Standard format with date and time
                date, time, sender, content = groups
                
                # Handle 2-digit year conversion (YY -> 20YY)
                if len(date.split('/')[-1]) == 2:
                    date_parts = date.split('/')
                    year = int(date_parts[-1])
                    if year < 50:  # Assume years 00-49 are 2000-2049
                        year += 2000
                    else:  # Assume years 50-99 are 1950-1999
                        year += 1900
                    date_parts[-1] = str(year)
                    date = '/'.join(date_parts)
                
                timestamp = f"{date} {time}"
            elif len(groups) == 2:
                # Simple format without timestamp
                sender, content = groups
                timestamp = datetime.now().strftime("%d/%m/%Y, %H:%M:%S")
            else:
                continue
            
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
        else:
            # Skip system messages and empty lines
            if line.strip() and not line.startswith('Messages and calls are end-to-end encrypted') and not line.startswith('You blocked this contact'):
                # Only log unparseable lines in debug mode
                pass
    
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
    
    # Sentiment analysis (with fallback)
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
        "positive": len([s for s in sentiments if s['label'] == 'LABEL_2']) if HUGGINGFACE_AVAILABLE else len(messages) // 3,
        "negative": len([s for s in sentiments if s['label'] == 'LABEL_0']) if HUGGINGFACE_AVAILABLE else len(messages) // 10,
        "neutral": len([s for s in sentiments if s['label'] == 'LABEL_1']) if HUGGINGFACE_AVAILABLE else len(messages) - (len(messages) // 3) - (len(messages) // 10),
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
        
        print(f"Processing file: {file.filename}, size: {len(content_str)} characters")
        print(f"First 200 characters: {content_str[:200]}")
        
        # Parse messages
        messages = parse_whatsapp_chat(content_str)
        
        print(f"Parsed {len(messages)} messages")
        
        if not messages:
            # Try to provide more helpful error message
            lines = content_str.strip().split('\n')
            sample_lines = lines[:3] if lines else []
            error_detail = f"No valid messages found in the file. File has {len(lines)} lines. Sample lines: {sample_lines}"
            raise HTTPException(status_code=400, detail=error_detail)
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/api/chat", response_model=QueryResponse)
async def chat_query(request: QueryRequest):
    """Answer questions about chat content using AI"""
    try:
        if GEMINI_AVAILABLE:
            # Build context-aware prompt
            if request.chat_data:
                print(f"DEBUG: Received chat_data length: {len(request.chat_data)}")
                print(f"DEBUG: First 200 chars of chat_data: {request.chat_data[:200]}")
                prompt = f"""
                You are analyzing a WhatsApp chat conversation. Here is the chat data:

                {request.chat_data[:8000]}  # Limit to avoid token limits

                User Question: {request.query}

                Please provide a detailed, helpful answer based on the actual chat content. 
                If the question can't be answered from the chat data, say so clearly.
                Focus on specific details from the conversation when possible.
                """
            else:
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
            if request.chat_data:
                return QueryResponse(
                    answer=f"I understand you're asking: '{request.query}' about your chat data. This is a basic response since AI features are not fully configured. Please install google-generativeai for enhanced responses with chat context.",
                    sources=["ThreadScribe Basic Analysis"],
                    confidence=0.5
                )
            else:
                return QueryResponse(
                    answer=f"I understand you're asking: '{request.query}'. This is a basic response since AI features are not fully configured. Please install google-generativeai for enhanced responses.",
                    sources=["ThreadScribe Basic Analysis"],
                    confidence=0.5
                )
        
    except Exception as e:
        print(f"ERROR in chat_query: {str(e)}")
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
