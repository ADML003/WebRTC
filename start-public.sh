#!/bin/bash

echo "🌐 Setting up public access with ngrok..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Installing..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install ngrok/ngrok/ngrok
        else
            echo "Please install Homebrew first, then run: brew install ngrok/ngrok/ngrok"
            exit 1
        fi
    else
        echo "Please install ngrok manually from: https://ngrok.com/download"
        echo "Or run: npm install -g ngrok"
        exit 1
    fi
fi

# Kill any existing servers
echo "🛑 Stopping any existing servers..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 2

# Start the local server
echo "🚀 Starting local WebRTC server..."
node server/simple-index.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Start ngrok tunnel
echo "🌐 Creating public tunnel with ngrok..."
ngrok http 3000 --log=stdout &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the ngrok URL
echo ""
echo "🎉 Public access is now available!"
echo ""
echo "📋 To get your public URLs:"
echo "1. Check the ngrok output above for the public URL"
echo "2. Look for lines like: 'Forwarding https://abc123.ngrok.io -> http://localhost:3000'"
echo "3. Use the HTTPS URL for mobile access"
echo ""
echo "📱 Mobile URLs will be:"
echo "   Phone Camera: https://YOUR-NGROK-URL/phone"
echo "   QR Code Page: https://YOUR-NGROK-URL/qr"
echo ""
echo "🖥️ Browser Viewer: https://YOUR-NGROK-URL/"
echo ""
echo "Press Ctrl+C to stop both server and tunnel"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping server and tunnel..."
    kill $SERVER_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    pkill -f "ngrok" 2>/dev/null || true
    echo "✅ Cleanup complete"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup INT TERM

# Keep script running
wait
