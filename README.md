# ThreadScribe 📖✨
**Summarize and analyze your WhatsApp conversations with ease.**

ThreadScribe is an AI-powered tool that helps you upload or stream WhatsApp chats and automatically generates:  
- 📑 **Summaries** of long conversations  
- ✅ **Checklists** for action items  
- 📝 **Decisions & Agreements** made in chat  
- ❓ **Open Questions** that need follow-up  

Perfect for students, teams, and professionals who want to stay organized without scrolling through endless chats.  

---

## 🚀 Features  
- **Upload Chat** – Import exported WhatsApp `.txt` chat files.  
- **Live Chat (MCP)** – Connect with WhatsApp via MCP bridge for real-time conversation processing.  
- **AI-Powered Summarization** – Generate structured summaries, decisions, questions, and tasks.  
- **Interactive Dashboard** – View results in cards with checklists, summaries, and filters.  
- **Fast & Secure** – Proxy-based backend (FastAPI) ensures safe communication with MCP.  

---

## 🏗️ Architecture  
```
Frontend (React + Tailwind + React Router)
        |
        v
Backend Proxy (FastAPI)
        |
        v
WhatsApp MCP Server (Go-based bridge + FastAPI)
        |
        v
AI Summarization Engine (LLMs, Hugging Face/Open Source models)
```

---

## ⚡ Tech Stack  
- **Frontend:** React, TypeScript, Vite, TailwindCSS, Shadcn UI  
- **Backend:** FastAPI (Python)  
- **MCP:** Go-based WhatsApp bridge + FastAPI MCP server  
- **AI:** Hugging Face / Open-source LLMs  
- **Hosting:** AWS EC2 (for backend), Vercel/Netlify (for frontend)  

---

## 📂 Project Structure  
```
ThreadScribe/
├── frontend/           # React + Tailwind frontend
│   ├── pages/UploadPage/
│   │   ├── LandingPage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── ResultPage.tsx
│   └── ...
├── backend/            # FastAPI backend
│   ├── main.py
│   ├── routes/
│   └── utils/
├── mcp-server/         # WhatsApp MCP bridge (Go + FastAPI)
└── README.md
```

---

## ⚙️ Installation  

### 1. Clone Repo  
```bash
git clone https://github.com/your-username/threadscribe.git
cd threadscribe
```

### 2. Backend Setup (FastAPI)  
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup (React + Vite + Tailwind)  
```bash
cd frontend
npm install
npm run dev
```

### 4. MCP Server Setup  
- Install Go & Python dependencies  
- Run MCP bridge for WhatsApp live chat  

---

## 🖥️ Usage  
1. Start backend (`FastAPI` on port 8000).  
2. Start frontend (`npm run dev`).  
3. Choose **Upload Chat** or **Live Chat** on landing page.  
4. Get structured summaries, checklists, and decisions instantly.  

---

## 🔮 Roadmap  
- [ ] Multi-language support  
- [ ] Integration with Slack & Telegram  
- [ ] Export results as PDF/Markdown  
- [ ] Smart search across conversations  

---

## 🤝 Contributing  
Pull requests are welcome! For major changes, open an issue first to discuss what you’d like to change.  

---

## 📜 License  
MIT License © 2025 Abhinav Kumar  
