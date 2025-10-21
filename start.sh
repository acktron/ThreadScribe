#!/bin/bash

# ThreadScribe Startup Script
echo "🚀 Starting ThreadScribe..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}Port $1 is available${NC}"
        return 0
    fi
}

# Check if required ports are available
echo -e "${BLUE}Checking ports...${NC}"
check_port 8000 || exit 1
check_port 8081 || exit 1
check_port 5173 || exit 1

# Start Backend
echo -e "${BLUE}Starting FastAPI Backend...${NC}"
cd backend
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp env.example .env
    echo -e "${YELLOW}Please edit .env file with your API keys${NC}"
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1

# Start backend in background
python main.py &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID: $BACKEND_PID${NC}"

# Start WhatsApp Bridge
echo -e "${BLUE}Starting WhatsApp Bridge...${NC}"
cd ../whatsapp-bridge

# Install Go dependencies
go mod tidy > /dev/null 2>&1

# Start bridge in background
go run main.go &
BRIDGE_PID=$!
echo -e "${GREEN}WhatsApp Bridge started with PID: $BRIDGE_PID${NC}"

# Start Frontend
echo -e "${BLUE}Starting React Frontend...${NC}"
cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install > /dev/null 2>&1
fi

# Start frontend in background
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started with PID: $FRONTEND_PID${NC}"

# Wait a moment for services to start
sleep 3

# Check if services are running
echo -e "${BLUE}Checking service status...${NC}"

# Check backend
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running on http://localhost:8000${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
fi

# Check WhatsApp bridge
if curl -s http://localhost:8081/api/status > /dev/null; then
    echo -e "${GREEN}✅ WhatsApp Bridge is running on http://localhost:8081${NC}"
else
    echo -e "${RED}❌ WhatsApp Bridge failed to start${NC}"
fi

# Check frontend
if curl -s http://localhost:5173 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is running on http://localhost:5173${NC}"
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ThreadScribe is now running!${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  Frontend:     http://localhost:5173"
echo -e "  Backend API:  http://localhost:8000"
echo -e "  WhatsApp:     http://localhost:8081"
echo ""
echo -e "${YELLOW}To stop all services, press Ctrl+C${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $BRIDGE_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Keep script running
wait
