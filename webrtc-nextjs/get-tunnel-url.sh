#!/bin/bash

echo "🔍 Looking for Cloudflare tunnel URL..."

# Method 1: Check if cloudflared is running and get its output
if pgrep -f cloudflared > /dev/null; then
    echo "✅ Cloudflare tunnel is running!"
    
    # Try to get tunnel URL from cloudflared metrics
    TUNNEL_URL=$(curl -s http://localhost:34567/metrics 2>/dev/null | grep "cloudflared_tunnel_url" | sed 's/.*url="\([^"]*\)".*/\1/')
    
    if [ ! -z "$TUNNEL_URL" ]; then
        echo "🌍 PUBLIC TUNNEL URL: $TUNNEL_URL"
        echo ""
        echo "📱 Mobile URLs:"
        echo "   Phone Camera: $TUNNEL_URL/phone"
        echo "   QR Code Page: $TUNNEL_URL/qr"
        echo ""
        echo "🖥️ Browser Viewer: $TUNNEL_URL/"
    else
        echo "⚠️  Tunnel is running but URL not found in metrics."
        echo "💡 Check the terminal output where you started the tunnel for the URL."
        echo "💡 Look for a line like: https://abc123.trycloudflare.com"
    fi
else
    echo "❌ Cloudflare tunnel is not running."
    echo "💡 Run ./setup-public.sh to start the tunnel."
fi

echo ""
echo "🏠 LOCAL ACCESS (same WiFi network):"
echo "   QR Code: http://192.168.1.7:3000/qr"
echo "   Phone: http://192.168.1.7:3000/phone"
echo "   Browser: http://192.168.1.7:3000/"
