#!/bin/bash
set -e

#!/bin/bash

echo "🚀 Starting WebRTC Object Detection System..."
echo ""

# Check if in correct directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the WebRTC project root directory"
    exit 1
fi

# Kill any existing servers
echo "🛑 Stopping any existing servers..."
pkill -f "node.*server" 2>/dev/null || true
sleep 1

# Start the server
echo "🚀 Starting WebRTC server..."
node server/simple-index.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo ""
    echo "✅ Server started successfully!"
    echo ""
    echo "🌐 URLs:"
    echo "   Browser: http://localhost:3000"
    echo "   Phone:   http://localhost:3000/phone"
    echo "   Health:  http://localhost:3000/health"
    echo "   Metrics: http://localhost:3000/metrics"
    echo ""
    echo "📋 Instructions:"
    echo "1. Open http://localhost:3000/phone on your mobile device"
    echo "2. Open http://localhost:3000 on your computer"
    echo "3. Click 'Connect to Phone' and select your phone ID"
    echo "4. Allow camera access on phone and start streaming"
    echo "5. Watch live object detection on your computer!"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    
    # Keep script running
    wait $SERVER_PID
else
    echo "❌ Server failed to start"
    exit 1
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "📦 Using Docker mode..."
    docker-compose up --build
else
    echo "🔧 Using local mode..."
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing dependencies..."
        npm install
    fi
    
    # Download model if not exists
    if [ ! -f "models/yolov8n.onnx" ]; then
        echo "🧠 Downloading model..."
        mkdir -p models
        curl -L "https://github.com/ultralytics/assets/releases/download/v8.0.0/yolov8n.onnx" -o models/yolov8n.onnx
    fi
    
    echo "🌐 Starting server on http://localhost:3000"
    npm start
fi
