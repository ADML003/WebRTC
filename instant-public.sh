#!/bin/bash

echo "🌐 INSTANT PUBLIC ACCESS - Any Mobile Device Worldwide!"
echo ""

# Kill existing processes
pkill -f "node.*server" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 2

echo "🚀 Starting WebRTC server..."
node server/simple-index.js &
SERVER_PID=$!
sleep 3

echo "🌍 Creating public tunnel with Cloudflare..."
echo "This will give you a public HTTPS URL that works on any device!"
echo ""

# Start Cloudflare tunnel
cloudflared tunnel --url localhost:3000 &
TUNNEL_PID=$!

echo ""
echo "⏳ Setting up tunnel... (this takes a few seconds)"
sleep 5

echo ""
echo "🎉 PUBLIC ACCESS IS NOW LIVE!"
echo ""
echo "📋 LOOK FOR YOUR PUBLIC URL ABOVE!"
echo "It will look like: https://random-words-123.trycloudflare.com"
echo ""
echo "📱 Mobile URLs (use the https:// URL from above):"
echo "   Phone Camera: [YOUR-URL]/phone"
echo "   QR Code Page: [YOUR-URL]/qr"
echo ""
echo "🖥️ Browser Viewer: [YOUR-URL]/"
echo ""
echo "✅ NOW ANY MOBILE DEVICE CAN CONNECT!"
echo "   - No WiFi restrictions"
echo "   - Works from anywhere in the world"
echo "   - Secure HTTPS connection"
echo ""
echo "Press Ctrl+C to stop the tunnel"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping tunnel and server..."
    kill $TUNNEL_PID 2>/dev/null || true
    kill $SERVER_PID 2>/dev/null || true
    pkill -f "cloudflared" 2>/dev/null || true
    echo "✅ Cleanup complete"
    exit 0
}

trap cleanup INT TERM
wait
