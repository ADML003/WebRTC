#!/bin/bash
set -e

echo "🚀 Starting WebRTC Next.js Application..."
echo ""

# Check if in correct directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the WebRTC project root directory"
    exit 1
fi

# Kill any existing servers
echo "🛑 Stopping any existing servers..."
pkill -f "next" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
sleep 2

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the Next.js application
echo "🚀 Starting Next.js application..."
echo ""
echo "🌐 WebRTC Application will be available at:"
echo "   Browser: http://localhost:3000"
echo "   Phone:   http://localhost:3000/phone"
echo ""
echo "📱 Instructions:"
echo "1. Open http://localhost:3000/phone on your mobile device"
echo "2. Open http://localhost:3000 on your computer"
echo "3. Allow camera permissions on phone and start streaming"
echo "4. Connect from the browser interface"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
