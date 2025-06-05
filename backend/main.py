from fastapi import FastAPI, File, UploadFile, Request, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import re
from datetime import datetime
import logging
from typing import Optional, List, Dict
import time
from functools import lru_cache
import asyncio
from collections import deque
import httpx
import google.generativeai as genai
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyAyBON_nBokxQ2vZpsEXyd__auVg8OyS20')
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

# Create a chat instance
chat = model.start_chat(history=[])

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Rate limiting setup
class RateLimiter:
    def __init__(self, max_requests: int, time_window: int):
        self.max_requests = max_requests
        self.time_window = time_window  # in seconds
        self.requests = deque()

    async def is_allowed(self, jid: str) -> bool:
        now = time.time()
        
        # Remove old requests
        while self.requests and self.requests[0] < now - self.time_window:
            self.requests.popleft()
        
        if len(self.requests) >= self.max_requests:
            return False
            
        self.requests.append(now)
        return True

rate_limiter = RateLimiter(max_requests=30, time_window=60)  # 30 requests per minute

# Enhance the chat context storage to store per-contact messages
chat_context_storage = {
    "full_text": "",
    "contact_messages": {}  # Store messages per contact JID
}

# Enhanced prompt templates with better structure
PROMPT_TEMPLATES = {
    "general": """Here's a WhatsApp chat conversation:

{context}

User question: {question}

Please provide a clear and concise answer based only on the information shown in the chat above. If the information needed is not in the chat, please say so.""",
    
    "summary": """Here's a WhatsApp chat conversation:

{context}

Please provide a concise summary of this conversation, focusing on:
1. Main topics discussed
2. Key decisions made
3. Important action items or tasks
4. Any deadlines mentioned""",

    "analysis": """Here's a WhatsApp chat conversation:

{context}

Please analyze this conversation and extract:
1. Main participants and their roles
2. Key discussion points
3. Decisions made
4. Action items assigned
5. Important dates or deadlines
6. Any unresolved questions

Specific question: {question}"""
}

def format_chat_context(messages):
    """
    Format chat messages into a clear, readable conversation format.
    Includes sender info, timestamps, and proper spacing.
    """
    formatted_text = ""
    current_date = None
    
    # Sort messages by timestamp
    def parse_timestamp(ts):
        try:
            # Try parsing as milliseconds since epoch
            return float(ts)
        except (ValueError, TypeError):
            try:
                # Try parsing as ISO format
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                return dt.timestamp()
            except (ValueError, AttributeError):
                logger.error(f"Could not parse timestamp: {ts}")
                return 0
                return 0
    
    messages.sort(key=lambda x: parse_timestamp(x["timestamp"]))
    
    for msg in messages:
        try:
            # Parse timestamp
            ts = parse_timestamp(msg["timestamp"])
            timestamp = datetime.fromtimestamp(ts)
            
            message_date = timestamp.strftime('%Y-%m-%d')
            
            # Add date header if it's a new date

            if message_date != current_date:
                if current_date is not None:
                    formatted_text += "\n"
                formatted_text += f"\n[{message_date}]\n"
                current_date = message_date
            
            # Format the message with time and sender
            time_str = timestamp.strftime('%I:%M %p')
            sender = "You" if msg["fromMe"] else "Contact"
            message_text = msg.get("text", "").strip()
            
            # Skip empty messages
            if not message_text:
                continue
                
            # Add the formatted message
            formatted_text += f"[{time_str}] {sender}: {message_text}\n"
            
        except Exception as e:
            logger.error(f"Error formatting message: {e}, message: {msg}")
            continue
            
    return formatted_text.strip()

def create_prompt(context: str, question: str, template: str = "general") -> str:
    """
    Create a well-structured prompt for Gemini using the specified template.
    Handles different types of analysis based on the template type.
    """
    if template not in PROMPT_TEMPLATES:
        template = "general"
        
    return PROMPT_TEMPLATES[template].format(
        context=context,
        question=question
    )

# Function to call Gemini API
async def call_gemini_llm(prompt: str) -> Dict:
    """
    Call the Gemini API with proper configuration and error handling.
    Returns a dictionary containing the response and metadata.
    """
    try:
        # Configure generation parameters
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
        }

        # Send message using chat interface with generation config
        response = await chat.send_message_async(
            prompt,
            generation_config=generation_config
        )

        if not response or not response.text:
            raise Exception("Empty response from Gemini API")

        # Extract and process the response
        answer = response.text.strip()
        
        # Extract any dates mentioned in the response
        date_pattern = r'\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b'
        relevant_dates = list(set(re.findall(date_pattern, answer)))
        
        # Calculate a simple confidence score based on response length and structure
        confidence = min(0.95, 0.5 + (len(answer.split()) / 200))
        
        return {
            "answer": answer,
            "confidence": confidence,
            "relevant_dates": relevant_dates,
            "error": None
        }
        
    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        return {
            "answer": "I apologize, but I encountered an issue processing your request. Please try again.",
            "confidence": 0,
            "relevant_dates": [],
            "error": str(e)
        }

# MCP base URL
MCP_BASE_URL = "http://localhost:8080"

@app.get("/")
def read_root():
    return {"message": "ThreadScribe backend running."}

@app.get("/api/mcp/qr")
async def get_mcp_qr():
    try:
        async with httpx.AsyncClient() as client:
            print(f"Attempting to fetch QR code from {MCP_BASE_URL}/api/qr")
            res = await client.get(f"{MCP_BASE_URL}/api/qr")
            print(f"QR Response status: {res.status_code}")
            print(f"QR Response content: {res.text}")
            res.raise_for_status()
            data = res.json()
            qr_code = data.get("qr")
            if not qr_code:
                return JSONResponse(status_code=404, content={"error": "QR code not found"})
            return {"qr": qr_code}
    except httpx.HTTPError as e:
        print(f"HTTP Error in get_mcp_qr: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch QR code: {str(e)}"})
    except Exception as e:
        print(f"Unexpected error in get_mcp_qr: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Unexpected error: {str(e)}"})

@app.get("/api/mcp/status")
async def get_mcp_status():
    try:
        async with httpx.AsyncClient() as client:
            print(f"Attempting to fetch status from {MCP_BASE_URL}/api/status")
            res = await client.get(f"{MCP_BASE_URL}/api/status")
            print(f"Status Response status: {res.status_code}")
            print(f"Status Response content: {res.text}")
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        print(f"HTTP Error in get_mcp_status: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch status: {str(e)}"})
    except Exception as e:
        print(f"Unexpected error in get_mcp_status: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Unexpected error: {str(e)}"})

@app.get("/api/mcp/chats")
async def get_mcp_chats():
    try:
        async with httpx.AsyncClient() as client:
            print(f"Attempting to fetch chats from {MCP_BASE_URL}/api/chats")
            res = await client.get(f"{MCP_BASE_URL}/api/chats")
            print(f"Chats Response status: {res.status_code}")
            print(f"Chats Response content: {res.text}")
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        print(f"HTTP Error in get_mcp_chats: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch chats: {str(e)}"})
    except Exception as e:
        print(f"Unexpected error in get_mcp_chats: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Unexpected error: {str(e)}"})

@app.get("/api/mcp/messages")
async def get_mcp_messages(chatId: str):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MCP_BASE_URL}/api/messages", params={"chatId": chatId})
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch messages: {str(e)}"})

@app.post("/api/mcp/send-message")
async def proxy_send_message(request: Request):
    try:
        body = await request.json()
        if "phone" in body:
            body["recipient"] = body.pop("phone")

        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{MCP_BASE_URL}/api/send",
                json=body,
                headers={"Content-Type": "application/json"},
            )
            try:
                content = res.json()
            except Exception:
                content = {"error": res.text}
        return JSONResponse(status_code=res.status_code, content=content)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/query-llm")
async def query_llm(request: Request):
    try:
        body = await request.json()
        jid = body.get("jid")
        question = body.get("question", "").strip()
        template = body.get("template", "general")
        
        if not jid or not question:
            return JSONResponse(
                status_code=400, 
                content={"error": "Both 'jid' and 'question' are required"}
            )

        # Auto-detect template based on question content
        if template == "general":
            question_lower = question.lower()
            if any(word in question_lower for word in ["summarize", "summary", "overview"]):
                template = "summary"
            elif any(word in question_lower for word in ["analyze", "analysis", "details", "breakdown"]):
                template = "analysis"

        # Fetch messages for this contact from MCP
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MCP_BASE_URL}/api/messages", params={"chatId": jid})
            res.raise_for_status()
            messages_data = res.json()
            
            if not messages_data.get("messages"):
                return JSONResponse(
                    status_code=404,
                    content={"error": "No messages found for this contact"}
                )
            
            # Process and format messages
            messages = []
            for msg in messages_data["messages"]:
                messages.append({
                    "timestamp": msg.get("Time", ""),
                    "fromMe": msg.get("IsFromMe", False),
                    "text": msg.get("Content", "")
                })
            
            # Format context for LLM
            chat_context = format_chat_context(messages)
            
            # Store in context storage
            chat_context_storage["contact_messages"][jid] = messages
            
            # Create prompt using selected template
            prompt = create_prompt(chat_context, question, template)

            # Generate response using Gemini
            response = await call_gemini_llm(prompt)
            
            if response.get("error"):
                return JSONResponse(
                    status_code=500,
                    content={"error": response["error"]}
                )

            return JSONResponse(content={
                "answer": response["answer"],
                "context_length": len(messages),
                "confidence": response["confidence"],
                "relevant_dates": response["relevant_dates"],
                "template_used": template
            })
            
    except httpx.HTTPError as e:
        logger.error(f"HTTP Error in query_llm: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch messages: {str(e)}"}
        )
    except Exception as e:
        logger.error(f"Unexpected error in query_llm: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"An unexpected error occurred: {str(e)}"}
        )

# ... rest of the existing code ...