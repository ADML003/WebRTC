#!/bin/bash

echo "🌐 Setting up public access for Next.js WebRTC app..."
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Installing cloudflared..."
    
    # Check if running on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install cloudflared
        else
            echo "Please install Homebrew first, then run: brew install cloudflared"
            echo "Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
            exit 1
        fi
    else
        echo "Please install cloudflared manually from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
fi

# Kill any existing servers and tunnels
echo "🛑 Stopping any existing servers and tunnels..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 2

# Start the Next.js server
echo "🚀 Starting Next.js WebRTC server..."
node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully!"
else
    echo "❌ Server failed to start"
    exit 1
fi

# Start cloudflare tunnel
echo "🌐 Creating public tunnel with Cloudflare..."
cloudflared tunnel --url http://localhost:3000 &
TUNNEL_PID=$!

# Wait for tunnel to start
sleep 5

echo ""
echo "🎉 Public access is now available!"
echo ""
echo "📋 To get your public URLs:"
echo "1. Check the cloudflared output above for the public URL"
echo "2. Look for lines like: 'https://abc123.trycloudflare.com'"
echo "3. Use the HTTPS URL for mobile access"
echo ""
echo "📱 Your mobile URLs will be:"
echo "   Phone Camera: https://YOUR-TUNNEL-URL/phone"
echo "   QR Code Page: https://YOUR-TUNNEL-URL/qr"
echo ""
echo "🖥️ Browser Viewer: https://YOUR-TUNNEL-URL/"
echo ""
echo "Press Ctrl+C to stop both server and tunnel"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping server and tunnel..."
    kill $SERVER_PID 2>/dev/null || true
    kill $TUNNEL_PID 2>/dev/null || true
    pkill -f "cloudflared" 2>/dev/null || true
    echo "✅ Cleanup complete"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup INT TERM

# Keep script running
wait
