from fastapi import FastAPI, File, UploadFile, Request, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import re
from datetime import datetime
import logging
from typing import Optional, List, Dict
import time
from functools import lru_cache
import asyncio
from collections import deque
import httpx
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Your frontend URL
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

# Load model/tokenizer at startup with error handling
try:
    logger.info("Loading flan-t5-large model and tokenizer...")
    model_name = "google/flan-t5-large"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    model.eval()  # Set model to evaluation mode
    logger.info("Successfully loaded model and tokenizer")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise

# Enhance the chat context storage to store per-contact messages
chat_context_storage = {
    "full_text": "",
    "contact_messages": {}  # Store messages per contact JID
}

# MCP base URL
MCP_BASE_URL = "http://localhost:8080"

# ------------------- Helper Functions -------------------

def parse_chat(text):
    pattern = re.compile(
        r"^(\d{1,2}/\d{1,2}/\d{2,4}), (\d{1,2}:\d{2} [APMapm]{2}) - (.*?): (.*)$"
    )
    messages = []
    current_msg = None

    for line in text.splitlines():
        match = pattern.match(line)
        if match:
            if current_msg:
                messages.append(current_msg)
            date_str, time_str, sender, message = match.groups()
            try:
                timestamp = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%y %I:%M %p")
            except ValueError:
                try:
                    timestamp = datetime.strptime(f"{date_str} {time_str}", "%d/%m/%Y %I:%M %p")
                except:
                    continue
            current_msg = {
                "sender": sender,
                "timestamp": timestamp.isoformat(),
                "message": message,
            }
        else:
            if current_msg:
                current_msg["message"] += "\n" + line
    if current_msg:
        messages.append(current_msg)
    return messages

def chunk_messages(messages, max_tokens=450):
    chunks = []
    current_chunk = []
    current_len = 0
    for msg in messages:
        msg_text = f"{msg['sender']}: {msg['message']}\n"
        msg_len = len(msg_text)
        if current_len + msg_len > max_tokens * 4:
            chunks.append("".join(current_chunk))
            current_chunk = [msg_text]
            current_len = msg_len
        else:
            current_chunk.append(msg_text)
            current_len += msg_len
    if current_chunk:
        chunks.append("".join(current_chunk))
    return chunks

def summarize_text(text, max_length=150):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    outputs = model.generate(
        **inputs,
        max_length=max_length,
        num_beams=4,
        early_stopping=True,
    )
    summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return summary

# Enhanced prompt templates for flan-t5
PROMPT_TEMPLATES = {
    "general": """Answer the following question based on the WhatsApp chat conversation provided.

Chat History:
{context}

Question: {question}

Answer: Let me analyze the chat and provide a detailed response.""",
    
    "summary": """Summarize the key points from this WhatsApp chat conversation:

{context}

Summary: Let me provide a clear summary of the main points."""
}

def create_prompt(context: str, question: str, template: str = "general") -> str:
    if not context.strip():
        raise HTTPException(status_code=400, detail="No valid chat context available")
        
    prompt = PROMPT_TEMPLATES[template].format(
        context=context,
        question=question
    )
    return prompt

def format_chat_context(messages):
    formatted_text = ""
    for msg in messages:
        timestamp = datetime.fromtimestamp(msg["Time"] / 1000)
        formatted_text += f"{timestamp.strftime('%m/%d/%y %I:%M %p')} - {msg['IsFromMe'] and 'You' or 'Contact'}: {msg['Content']}\n"
    return formatted_text

# ------------------- API Routes -------------------

@app.get("/")
def read_root():
    return {"message": "ThreadScribe backend running."}

@app.post("/api/parse-and-summarize")
async def parse_and_summarize(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = contents.decode("utf-8")
        messages = parse_chat(text)
        chunks = chunk_messages(messages)
        full_text = chunks[0] if chunks else ""
        summary = summarize_text(full_text)
        chat_context_storage["full_text"] = full_text
        return JSONResponse(content={"summary": summary})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/chat")
async def chat_with_context(query: str = Form(...)):
    try:
        context = chat_context_storage.get("full_text", "")
        if not context:
            return JSONResponse(status_code=400, content={"error": "No chat context available."})

        prompt = f"Chat:\n{context}\n\nQuestion: {query}\nAnswer:"
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        outputs = model.generate(
            **inputs,
            max_length=150,
            num_beams=4,
            early_stopping=True,
        )
        answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return JSONResponse(content={"answer": answer})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

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

@app.post("/api/mcp/logout")
async def logout_mcp():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{MCP_BASE_URL}/api/logout")
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        return JSONResponse(status_code=500, content={"error": f"Logout failed: {str(e)}"})

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

@app.post("/api/query-llm")
async def query_llm(request: Request):
    try:
        body = await request.json()
        jid = body.get("jid")
        question = body.get("question")
        
        if not jid or not question:
            return JSONResponse(
                status_code=400, 
                content={"error": "Both 'jid' and 'question' are required"}
            )

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
            
            # Format context for LLM
            chat_context = format_chat_context(messages_data["messages"])
            
            # Store in context storage
            chat_context_storage["contact_messages"][jid] = messages_data["messages"]
            
            # Prepare prompt for LLM
            prompt = f"""Below is a WhatsApp chat conversation. Please answer the question based on the chat content.

Chat History:
{chat_context}

Question: {question}

Answer: """

            # Generate response using LLM
            inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
            outputs = model.generate(
                **inputs,
                max_length=200,
                num_beams=4,
                temperature=0.7,
                early_stopping=True,
            )
            answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            return JSONResponse(content={
                "answer": answer,
                "context_length": len(messages_data["messages"])
            })
            
    except httpx.HTTPError as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch messages: {str(e)}"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Unexpected error: {str(e)}"}
        )
