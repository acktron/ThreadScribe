#!/bin/bash

# WhatsApp Bridge Auto-Restart Script
echo "Starting WhatsApp Bridge with auto-restart..."

# Function to kill existing bridge processes
kill_bridge() {
    echo "Killing existing bridge processes..."
    pkill -f "go run main.go" || true
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Kill any existing processes first
kill_bridge

while true; do
    echo "$(date): Starting WhatsApp bridge..."
    cd /Users/abhinav/Desktop/ThreadScribe/whatsapp-bridge
    go run main.go
    
    echo "$(date): WhatsApp bridge exited with code $?. Restarting in 3 seconds..."
    sleep 3
done
