// Custom server for Railway deployment
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Important for Railway
const port = parseInt(process.env.PORT) || 3000; // Railway sets PORT automatically

console.log(`🚀 Starting server in ${dev ? 'development' : 'production'} mode`);
console.log(`📡 Binding to ${hostname}:${port}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔧 Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set'}`);

const app = next({ 
  dev, 
  hostname, 
  port,
  customServer: true,
  conf: {
    poweredByHeader: false,
    compress: true
  }
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Add CORS headers for WebRTC
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });

  server.listen(port, hostname, (err) => {
    if (err) {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
    console.log(`✅ Server ready on http://${hostname}:${port}`);
    console.log(`🌐 Railway URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'webrtc-production-bd78.up.railway.app'}`);
    console.log(`🔍 Health check: http://${hostname}:${port}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});
