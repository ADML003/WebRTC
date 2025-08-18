const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handler(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Setup Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Import and initialize WebRTC handlers after server setup
  const { setupSocketHandlers, setupMetrics } = require('./lib/webrtc-server');
  setupSocketHandlers(io);
  setupMetrics();

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Next.js WebRTC server running on http://${hostname}:${port}`);
      console.log(`📱 Phone Camera: http://${hostname}:${port}/phone`);
      console.log(`🖥️ Browser Viewer: http://${hostname}:${port}/`);
      console.log(`📋 QR Code: http://${hostname}:${port}/qr`);
    });
});
