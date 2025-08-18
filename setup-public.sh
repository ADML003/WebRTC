#!/bin/bash

echo "🌐 PUBLIC ACCESS SETUP - Connect ANY Mobile Device!"
echo ""

# Kill any existing processes
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 2

echo "🚀 Starting local server..."
node server/simple-index.js &
SERVER_PID=$!
sleep 3

echo ""
echo "🌐 CHOOSE YOUR PUBLIC ACCESS METHOD:"
echo ""
echo "1. 🔥 ngrok (Recommended) - Instant public HTTPS URL"
echo "2. 🌍 Cloudflare Tunnel - Free, no account needed"
echo "3. ☁️ Deploy to Vercel - Permanent public URL"
echo "4. 🚀 Deploy to Railway - Modern hosting"
echo ""

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo "🔥 Setting up ngrok tunnel..."
        if command -v ngrok &> /dev/null; then
            echo "Starting ngrok tunnel..."
            ngrok http 3000 --log=stdout
        else
            echo "❌ ngrok not installed. Install with:"
            echo "   brew install ngrok/ngrok/ngrok"
            echo "   OR download from: https://ngrok.com/download"
        fi
        ;;
    2)
        echo "🌍 Setting up Cloudflare Tunnel..."
        if command -v cloudflared &> /dev/null; then
            cloudflared tunnel --url localhost:3000
        else
            echo "Installing Cloudflare Tunnel..."
            if [[ "$OSTYPE" == "darwin"* ]]; then
                brew install cloudflared
                cloudflared tunnel --url localhost:3000
            else
                echo "Please install cloudflared manually from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
            fi
        fi
        ;;
    3)
        echo "☁️ Deploying to Vercel..."
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo "Installing Vercel CLI..."
            npm install -g vercel
            vercel --prod
        fi
        ;;
    4)
        echo "🚀 Deploying to Railway..."
        if command -v railway &> /dev/null; then
            railway up
        else
            echo "Installing Railway CLI..."
            npm install -g @railway/cli
            railway login
            railway up
        fi
        ;;
    *)
        echo "❌ Invalid option. Please run script again."
        ;;
esac

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Cleaning up..."
    kill $SERVER_PID 2>/dev/null || true
    pkill -f "ngrok" 2>/dev/null || true
    pkill -f "cloudflared" 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM
wait
