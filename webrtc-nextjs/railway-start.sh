#!/bin/bash

# Railway startup diagnostic script
echo "🔍 Railway Startup Diagnostics"
echo "=============================="
echo "🕒 Timestamp: $(date)"
echo "🌍 NODE_ENV: ${NODE_ENV:-'not set'}"
echo "📡 PORT: ${PORT:-'not set'}"
echo "🚀 RAILWAY_PUBLIC_DOMAIN: ${RAILWAY_PUBLIC_DOMAIN:-'not set'}"
echo "💻 PWD: $(pwd)"
echo "📁 Contents:"
ls -la

echo ""
echo "🔧 Node.js version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

echo ""
echo "📋 Package.json scripts:"
cat package.json | grep -A 10 '"scripts"'

echo ""
echo "🏗️ Build directory contents:"
if [ -d ".next" ]; then
    echo "✅ .next directory exists"
    ls -la .next/
else
    echo "❌ .next directory not found"
fi

echo ""
echo "🚀 Starting application..."
exec node server.js
