from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import re
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import httpx
import asyncio

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Load model/tokenizer at startup
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-large")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")

# Simple cache
chat_context_storage = {"full_text": ""}

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
            res = await client.get(f"{MCP_BASE_URL}/api/qr")
            res.raise_for_status()
            data = res.json()
            qr_code = data.get("qr")
            if not qr_code:
                return JSONResponse(status_code=404, content={"error": "QR code not found"})
            return {"qr": qr_code}
    except httpx.HTTPError as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch QR code: {str(e)}"})

@app.get("/api/mcp/status")
async def get_mcp_status():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{MCP_BASE_URL}/api/status")
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch status: {str(e)}"})

@app.post("/api/mcp/logout")
async def logout_mcp():
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{MCP_BASE_URL}/api/logout")
            res.raise_for_status()
            return JSONResponse(status_code=res.status_code, content=res.json())
    except httpx.HTTPError as e:
        return JSONResponse(status_code=500, content={"error": f"Logout failed: {str(e)}"})
