from fastapi import FastAPI, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import uvicorn

app = FastAPI()

# Allow frontend (localhost:5173 for Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Define the MCP base URL at the top so it's available everywhere
MCP_BASE_URL = "http://localhost:8080"

@app.get("/")
def read_root():
    return {"message": "ThreadScribe backend running."}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    text = contents.decode("utf-8")

    # Simple dummy summary logic (replace with actual)
    summary = {
        "summary": "This is a dummy summary.",
        "checklist": ["Task 1", "Task 2"],
        "decisions": ["Decision A"],
        "questions": ["Question X?"],
    }

    return summary

@app.post("/api/mcp/send-message")
async def proxy_send_message(request: Request):
    try:
        body = await request.json()
        # Convert phone -> recipient for Go backend
        if "phone" in body:
            body["recipient"] = body.pop("phone")
        
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{MCP_BASE_URL}/api/send", json=body)
            try:
                content = res.json()
            except Exception:
                content = {"error": res.text}
        return JSONResponse(status_code=res.status_code, content=content)
    except Exception as e:
        print("Error in proxy_send_message:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})