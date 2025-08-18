console.log("🚀 Starting simple test server...");

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

// Serve static files
app.use(express.static("public"));

// Simple routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Simple server running" });
});

app.get("/", (req, res) => {
  res.send(`
        <h1>WebRTC Test Server</h1>
        <p>Server is running correctly!</p>
        <a href="/phone">Phone Page</a><br>
        <a href="/health">Health Check</a>
    `);
});

app.get("/phone", (req, res) => {
  res.send(`
        <h1>Phone Page</h1>
        <p>This would be the phone interface</p>
        <a href="/">Back to Home</a>
    `);
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("📱 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("📱 Client disconnected:", socket.id);
  });
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Test server running on http://localhost:${port}`);
  console.log(`📱 Phone URL: http://localhost:${port}/phone`);
  console.log(`🖥️  Browser URL: http://localhost:${port}/`);
  console.log(`💊 Health Check: http://localhost:${port}/health`);
});

console.log("Server setup completed!");
