# ThreadScribe

**AI-powered WhatsApp chat analysis tool that transforms conversations into actionable insights**

ThreadScribe is a comprehensive solution that analyzes WhatsApp chats using advanced LLMs (Gemini, Hugging Face) to extract tasks, questions, decisions, and key insights. Built with React, FastAPI, GoLang, and TailwindCSS.

## 🚀 Features

- **AI-Powered Analysis**: Advanced LLM integration with Gemini and Hugging Face
- **Structured Summaries**: Transform conversations into actionable tasks, questions, and decisions
- **Live WhatsApp Integration**: Real-time chat streaming and analysis through WhatsApp MCP bridge
- **Interactive Dashboard**: Beautiful dashboard with checklist interactivity and sentiment analysis
- **Modern UI**: Built with React, TailwindCSS, and Framer Motion animations
- **Real-time Processing**: Live chat monitoring and instant analysis

## 🏗️ Architecture

```
ThreadScribe/
├── frontend/          # React + TypeScript + TailwindCSS
├── backend/           # FastAPI + Python
├── whatsapp-bridge/   # Go WhatsApp MCP bridge
└── docs/             # Documentation
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Axios** for API calls
- **Lucide React** for icons

### Backend
- **FastAPI** for REST API
- **Google Gemini AI** for text analysis
- **Hugging Face Transformers** for sentiment analysis
- **SQLAlchemy** for database management
- **Pydantic** for data validation

### WhatsApp Bridge
- **Go** with whatsmeow library
- **SQLite** for message storage
- **WebSocket** support for real-time communication

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- Go 1.21+
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ThreadScribe
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Copy environment variables
cp env.example .env
# Edit .env with your API keys
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. WhatsApp Bridge Setup
```bash
cd whatsapp-bridge
go mod tidy
```

## 🚀 Running the Application

### 1. Start the Backend
```bash
cd backend
python main.py
```
Backend will run on `http://localhost:8000`

### 2. Start the WhatsApp Bridge
```bash
cd whatsapp-bridge
go run main.go
```
Bridge will run on `http://localhost:8081`

### 3. Start the Frontend
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
DATABASE_URL=sqlite:///./threadscribe.db
REDIS_URL=redis://localhost:6379
WHATSAPP_BRIDGE_URL=http://localhost:8081
```

### API Keys
1. **Gemini API**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Hugging Face**: Get your API key from [Hugging Face](https://huggingface.co/settings/tokens)

## 📱 Usage

### Upload Chat Analysis
1. Export your WhatsApp chat (without media)
2. Go to `/upload` page
3. Upload the `.txt` file
4. View structured analysis results

### Live Analysis
1. Go to `/whatsapp-live` page
2. Ensure WhatsApp bridge is running
3. Scan QR code to connect WhatsApp
4. Monitor live conversations and analysis

### Dashboard
1. Go to `/dashboard` page
2. View overall statistics and insights
3. Access quick actions and recent activity

## 🔍 API Endpoints

### Backend API (`http://localhost:8000`)
- `POST /api/parse-and-summarize` - Upload and analyze chat file
- `POST /api/chat` - Query chat analysis
- `GET /api/whatsapp/status` - Check WhatsApp bridge status
- `GET /api/whatsapp/chats` - Get available chats
- `GET /api/whatsapp/messages/{chat_id}` - Get messages from chat

### WhatsApp Bridge API (`http://localhost:8081`)
- `GET /api/status` - Bridge connection status
- `GET /api/chats` - Available chats
- `GET /api/messages?chatId={id}` - Messages from specific chat
- `GET /api/qr` - QR code for WhatsApp connection

## 🎨 UI Components

- **Landing Page**: Modern hero section with feature highlights
- **Upload Page**: Drag-and-drop file upload with progress
- **Results Page**: Tabbed interface for different analysis types
- **Live Page**: Real-time chat monitoring
- **Dashboard**: Statistics and quick actions

## 🔒 Security

- CORS enabled for development
- Input validation with Pydantic
- SQL injection protection
- Environment variable security

## 🚀 Deployment

### Docker (Coming Soon)
```bash
docker-compose up -d
```

### Manual Deployment
1. Build frontend: `npm run build`
2. Serve static files with nginx
3. Run backend with gunicorn
4. Run WhatsApp bridge as service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the API documentation

## 🔮 Roadmap

- [ ] Docker containerization
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Export functionality
- [ ] Mobile app
- [ ] Team collaboration features
- [ ] Integration with other messaging platforms

---

**Built with ❤️ using React, FastAPI, GoLang, and TailwindCSS**
