from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import re
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load tokenizer and model once at startup
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-large")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")

def parse_chat(text):
    """
    Parses WhatsApp chat text into structured messages.
    """
    message_pattern = re.compile(r"^(\d{1,2}/\d{1,2}/\d{2,4}), (\d{1,2}:\d{2} [APMapm]{2}) - (.*?): (.*)$")
    messages = []
    current_msg = None

    for line in text.splitlines():
        match = message_pattern.match(line)
        if match:
            if current_msg:
                messages.append(current_msg)

            date_str = match.group(1)
            time_str = match.group(2)
            sender = match.group(3)
            message = match.group(4)

            # Combine date and time
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
                "message": message
            }
        else:
            # Continuation of previous message
            if current_msg:
                current_msg["message"] += "\n" + line

    if current_msg:
        messages.append(current_msg)

    return messages

def chunk_messages(messages, max_tokens=450):
    """
    Break messages into chunks of messages that fit within max token length.
    Approximate by character length for simplicity.
    """
    chunks = []
    current_chunk = []
    current_len = 0

    for msg in messages:
        msg_text = f"{msg['sender']}: {msg['message']}\n"
        msg_len = len(msg_text)

        if current_len + msg_len > max_tokens * 4:  # Rough char to token approx (4 chars/token)
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
    """
    Summarizes text using local flan-t5-large model.
    """
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    outputs = model.generate(
        **inputs,
        max_length=max_length,
        num_beams=4,
        early_stopping=True,
    )
    summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return summary

@app.post("/api/parse-and-summarize")
async def parse_and_summarize(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = contents.decode("utf-8")

        # Step 1: Parse
        messages = parse_chat(text)

        # Step 2: Chunk (still keeping it in case needed)
        chunks = chunk_messages(messages)

        # Step 3: Summarize (but we assume only one chunk)
        full_text = chunks[0] if chunks else ""
        summary = summarize_text(full_text)

        return JSONResponse(content={"summary": summary})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

