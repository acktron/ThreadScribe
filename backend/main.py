from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import re
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import httpx

app = FastAPI()

# CORS setup (allow your frontend origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Load tokenizer and model once at startup
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-large")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")

# In-memory store for last uploaded chat (simple temporary cache)
chat_context_storage = {"full_text": ""}

MCP_BASE_URL = "http://localhost:8080"  # WhatsApp MCP backend URL

# --- Helper functions for chat parsing and summarization ---

def parse_chat(text):
    message_pattern = re.compile(
        r"^(\d{1,2}/\d{1,2}/\d{2,4}), (\d{1,2}:\d{2} [APMapm]{2}) - (.*?): (.*)$"
    )
    messages = []
    current_msg = None

    for line in text.splitlines():
        match = message_pattern.match(line)
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

# --- API routes ---

@app.get("/")
def read_root():
    return {"message": "ThreadScribe backend running."}

# Upload and summarize chat file
@app.post("/api/parse-and-summarize")
async def parse_and_summarize(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = contents.decode("utf-8")
        messages = parse_chat(text)
        chunks = chunk_messages(messages)
        full_text = chunks[0] if chunks else ""
        summary = summarize_text(full_text)

        # Store for chat context (used in chat queries)
        chat_context_storage["full_text"] = full_text

        return JSONResponse(content={"summary": summary})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Chat query with context from last uploaded chat
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

# Proxy sending live WhatsApp messages via MCP backend
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
        print("Error in proxy_send_message:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

