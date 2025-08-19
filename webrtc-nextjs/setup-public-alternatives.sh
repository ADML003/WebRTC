#!/bin/bash

echo "🌐 PUBLIC ACCESS ALTERNATIVES (No Cloudflare)"
echo "=============================================="
echo ""

# Stop any existing processes
echo "🛑 Stopping existing processes..."
pkill -f "cloudflared|node|next|localtunnel|serveo" 2>/dev/null || true
sleep 2

# Start the server
echo "🚀 Starting Next.js server..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!
sleep 10

echo "✅ Server started on http://localhost:3000"
echo ""

echo "🌍 CHOOSE YOUR PUBLIC ACCESS METHOD:"
echo "1. 🚇 LocalTunnel - Free, no account needed"
echo "2. 🌊 Serveo - SSH-based tunnel, no installation"
echo "3. 🔗 Expose - Simple HTTP tunnel"
echo "4. ☁️ Deploy to Vercel - Permanent hosting"
echo ""

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo "🚇 Setting up LocalTunnel..."
        if ! command -v lt &> /dev/null; then
            echo "📥 Installing LocalTunnel..."
            npm install -g localtunnel
        fi
        
        echo "🌐 Creating public tunnel..."
        lt --port 3000 --subdomain webrtc-$(date +%s) > tunnel.log 2>&1 &
        TUNNEL_PID=$!
        
        sleep 5
        TUNNEL_URL=$(grep -o 'https://[^[:space:]]*' tunnel.log | head -1)
        
        if [ ! -z "$TUNNEL_URL" ]; then
            echo "🎉 PUBLIC ACCESS READY!"
            echo "================================"
            echo "🌍 Main URL: $TUNNEL_URL"
            echo "📱 Phone Camera: $TUNNEL_URL/phone"
            echo "📋 QR Code: $TUNNEL_URL/qr"
            echo "🖥️ Browser Viewer: $TUNNEL_URL/"
            echo "================================"
        else
            echo "❌ Failed to get tunnel URL. Check tunnel.log"
        fi
        ;;
        
    2)
        echo "🌊 Setting up Serveo tunnel..."
        echo "🌐 Creating SSH tunnel..."
        ssh -R 80:localhost:3000 serveo.net > tunnel.log 2>&1 &
        TUNNEL_PID=$!
        
        sleep 10
        TUNNEL_URL=$(grep -o 'https://[^[:space:]]*serveo.net' tunnel.log | head -1)
        
        if [ ! -z "$TUNNEL_URL" ]; then
            echo "🎉 PUBLIC ACCESS READY!"
            echo "================================"
            echo "🌍 Main URL: $TUNNEL_URL"
            echo "📱 Phone Camera: $TUNNEL_URL/phone"
            echo "📋 QR Code: $TUNNEL_URL/qr"
            echo "🖥️ Browser Viewer: $TUNNEL_URL/"
            echo "================================"
        else
            echo "❌ Failed to get tunnel URL. Check tunnel.log"
        fi
        ;;
        
    3)
        echo "🔗 Setting up simple HTTP tunnel..."
        if ! command -v python3 &> /dev/null; then
            echo "❌ Python3 is required for this option"
            exit 1
        fi
        
        # Create a simple HTTP proxy
        python3 -c "
import http.server
import socketserver
import threading
import requests
from urllib.parse import urljoin
import time

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        try:
            response = requests.get(f'http://localhost:3000{self.path}')
            self.send_response(response.status_code)
            for header, value in response.headers.items():
                if header.lower() not in ['connection', 'transfer-encoding']:
                    self.send_header(header, value)
            self.end_headers()
            self.wfile.write(response.content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

PORT = 8080
with socketserver.TCPServer(('', PORT), ProxyHandler) as httpd:
    print(f'🌐 Local proxy running on port {PORT}')
    print(f'📱 Use your local IP: http://$(hostname -I | awk \"{print $1}\"):8080')
    httpd.serve_forever()
" &
        TUNNEL_PID=$!
        ;;
        
    4)
        echo "☁️ Setting up Vercel deployment..."
        if ! command -v vercel &> /dev/null; then
            echo "📥 Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "🚀 Deploying to Vercel..."
        echo "Note: This will create a permanent public URL"
        vercel --prod
        ;;
        
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "💡 INSTRUCTIONS:"
echo "1. Use the QR code URL to generate QR codes for mobile access"
echo "2. Use the phone camera URL directly on mobile devices"
echo "3. Use the browser viewer URL on computers"
echo ""
echo "Press Ctrl+C to stop the tunnel and server"

# Keep script running
trap 'echo "🛑 Stopping tunnel and server..."; kill $TUNNEL_PID 2>/dev/null; kill $SERVER_PID 2>/dev/null; exit' INT

while true; do
    sleep 1
done

