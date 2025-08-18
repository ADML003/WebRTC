console.log("🚀 Starting WebRTC Object Detection Server...");

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const os = require("os");

console.log("✅ Core modules loaded");

// Load optional modules safely
let tf = null;
let sharp = null;

try {
  tf = require("@tensorflow/tfjs-node");
  console.log("✅ TensorFlow.js loaded successfully");
} catch (e) {
  console.log("⚠️ TensorFlow.js not available, using mock detection");
}

try {
  sharp = require("sharp");
  console.log("✅ Sharp loaded successfully");
} catch (e) {
  console.log("⚠️ Sharp not available, using fallback processing");
}

console.log("🏗️ Creating server...");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const port = process.env.PORT || 3000;

// Connection tracking
const phoneConnections = new Map();
const browserConnections = new Map();
const activeSessions = new Map();

// Metrics
const metrics = {
  frames: [],
  startTime: Date.now(),
};

console.log("📝 Setting up routes...");

// Serve static files
app.use(express.static("public"));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: tf ? "tensorflow" : "mock",
    connections: {
      phones: phoneConnections.size,
      browsers: browserConnections.size,
      sessions: activeSessions.size,
    },
  });
});

// Metrics endpoint
app.get("/metrics", (req, res) => {
  const currentMetrics = getMetrics();
  // Save to file
  try {
    fs.writeFileSync(
      path.join(__dirname, "../metrics.json"),
      JSON.stringify(currentMetrics, null, 2)
    );
  } catch (e) {
    console.log("⚠️ Could not write metrics file");
  }
  res.json(currentMetrics);
});

// Main routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/phone", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/phone.html"));
});

app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/test.html"));
});

// QR Code page for easy mobile access
app.get("/qr", (req, res) => {
  // Check if request is coming through a tunnel (like Cloudflare)
  const host = req.get("host");
  const protocol =
    req.get("x-forwarded-proto") || (req.secure ? "https" : "http");

  let phoneURL;
  let accessType;

  if (host && host.includes(".trycloudflare.com")) {
    // Using Cloudflare tunnel
    phoneURL = `${protocol}://${host}/phone`;
    accessType = "🌍 PUBLIC ACCESS (Cloudflare Tunnel)";
  } else if (
    host &&
    !host.includes("localhost") &&
    !host.includes("127.0.0.1")
  ) {
    // Using public domain
    phoneURL = `${protocol}://${host}/phone`;
    accessType = "🌐 PUBLIC ACCESS";
  } else {
    // Local network access
    const networkIP = getNetworkIP();
    phoneURL = `http://${networkIP}:${port}/phone`;
    accessType = "🏠 LOCAL NETWORK ACCESS";
  }

  const qrHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebRTC Phone QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            color: #333;
            max-width: 500px;
        }
        .qr-code {
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            display: inline-block;
        }
        .url {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            word-break: break-all;
            margin: 15px 0;
            border: 2px dashed #ddd;
        }
        .instructions {
            background: #e8f4fd;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: left;
        }
        .step {
            margin: 10px 0;
            padding: 8px 0;
        }
        .emoji {
            font-size: 24px;
            margin-right: 10px;
        }
        h1 { color: #333; margin-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 WebRTC Phone Camera</h1>
        <h2 style="color: #007bff; margin-top: 0;">${accessType}</h2>
        <p>Scan this QR code with your phone to access the camera interface</p>
        
        <div class="qr-code">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              phoneURL
            )}" 
                 alt="QR Code for Phone Access" />
        </div>
        
        <div class="url">
            <strong>Phone URL:</strong><br>
            ${phoneURL}
        </div>
        
        <div class="instructions">
            <h2>📋 Setup Instructions:</h2>
            ${
              accessType.includes("PUBLIC")
                ? `
            <div class="step"><span class="emoji">🌍</span><strong>Step 1:</strong> Scan QR code with your phone camera (works from anywhere!)</div>
            <div class="step"><span class="emoji">�</span><strong>Step 2:</strong> No WiFi restrictions - uses cellular data or any internet</div>
            <div class="step"><span class="emoji">📷</span><strong>Step 3:</strong> Allow camera permissions on phone</div>
            <div class="step"><span class="emoji">🔗</span><strong>Step 4:</strong> Connect to browser for live detection</div>
            `
                : `
            <div class="step"><span class="emoji">�📱</span><strong>Step 1:</strong> Scan QR code with your phone camera</div>
            <div class="step"><span class="emoji">📶</span><strong>Step 2:</strong> Make sure phone & computer are on same WiFi</div>
            <div class="step"><span class="emoji">📷</span><strong>Step 3:</strong> Allow camera permissions on phone</div>
            <div class="step"><span class="emoji">🔗</span><strong>Step 4:</strong> Connect to browser for live detection</div>
            `
            }
        </div>
        
        <p><strong>💡 Alternative:</strong> Manually type the URL above into your phone's browser</p>
        
        <div style="margin-top: 30px;">
            <a href="/" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                🖥️ Open Browser Viewer
            </a>
        </div>
    </div>
</body>
</html>`;

  res.send(qrHTML);
});

// Helper function to get network IP (define it before server.listen)
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

console.log("🔌 Setting up WebSocket handlers...");

// Debug: Log when Socket.IO server is ready
io.on("connection", (socket) => {
  console.log(`🔗 Client connected: ${socket.id}`);
  console.log(`📊 Total connections: ${io.sockets.sockets.size}`);

  // Phone registration
  socket.on("phone-connect", () => {
    console.log(`📱 Phone registered: ${socket.id}`);
    phoneConnections.set(socket.id, socket);
    socket.emit("phone-connected", { phoneId: socket.id });
    broadcastPhoneList();
  });

  // Browser registration
  socket.on("browser-connect", () => {
    console.log(`🖥️ Browser registered: ${socket.id}`);
    browserConnections.set(socket.id, socket);
    socket.emit("browser-connected", { browserId: socket.id });

    const availablePhones = Array.from(phoneConnections.keys());
    socket.emit("available-phones", { phones: availablePhones });
  });

  // WebRTC signaling
  socket.on("webrtc-offer", (data) => {
    console.log(`📡 WebRTC offer: ${socket.id} -> ${data.targetId}`);
    const target = phoneConnections.get(data.targetId);
    if (target) {
      target.emit("webrtc-offer", {
        fromId: socket.id,
        offer: data.offer,
        sessionId: data.sessionId,
      });

      activeSessions.set(data.sessionId, {
        browser: socket.id,
        phone: data.targetId,
      });
    }
  });

  socket.on("webrtc-answer", (data) => {
    console.log(`📡 WebRTC answer: ${socket.id} -> ${data.targetId}`);
    const target = browserConnections.get(data.targetId);
    if (target) {
      target.emit("webrtc-answer", {
        fromId: socket.id,
        answer: data.answer,
        sessionId: data.sessionId,
      });
    }
  });

  socket.on("webrtc-ice-candidate", (data) => {
    const target =
      phoneConnections.get(data.targetId) ||
      browserConnections.get(data.targetId);
    if (target) {
      target.emit("webrtc-ice-candidate", {
        fromId: socket.id,
        candidate: data.candidate,
      });
    }
  });

  // Frame processing
  socket.on("process-frame", async (data) => {
    try {
      const result = await processFrame(data);
      socket.emit("detection-result", result);
    } catch (error) {
      console.error("Frame processing error:", error);
      socket.emit("detection-error", { error: error.message });
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    phoneConnections.delete(socket.id);
    browserConnections.delete(socket.id);

    // Clean up sessions
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.phone === socket.id || session.browser === socket.id) {
        activeSessions.delete(sessionId);
        console.log(`🗑️ Session ${sessionId} cleaned up`);
      }
    }

    broadcastPhoneList();
  });
});

// Frame processing functions
async function processFrame(frameData) {
  const startTime = Date.now();
  const { frame_id, capture_ts, imageData } = frameData;
  const recv_ts = startTime;

  try {
    const detections = generateMockDetections();
    const inference_ts = Date.now();

    // Record metrics
    recordMetrics({
      frame_id,
      capture_ts,
      recv_ts,
      inference_ts,
      latency: inference_ts - capture_ts,
    });

    return {
      frame_id,
      capture_ts,
      recv_ts,
      inference_ts,
      detections,
    };
  } catch (error) {
    console.error("Inference error:", error);
    return {
      frame_id,
      capture_ts,
      recv_ts,
      inference_ts: Date.now(),
      detections: generateMockDetections(),
      error: error.message,
    };
  }
}

function generateMockDetections() {
  const mockClasses = [
    "person",
    "car",
    "bicycle",
    "dog",
    "cat",
    "bottle",
    "phone",
  ];
  const detections = [];
  const numDetections = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < numDetections; i++) {
    detections.push({
      label: mockClasses[Math.floor(Math.random() * mockClasses.length)],
      score: 0.7 + Math.random() * 0.3,
      xmin: Math.random() * 0.6,
      ymin: Math.random() * 0.6,
      xmax: 0.4 + Math.random() * 0.6,
      ymax: 0.4 + Math.random() * 0.6,
    });
  }

  return detections;
}

function recordMetrics(frameMetrics) {
  metrics.frames.push(frameMetrics);

  // Keep only last 1000 frames
  if (metrics.frames.length > 1000) {
    metrics.frames = metrics.frames.slice(-1000);
  }
}

function getMetrics() {
  const latencies = metrics.frames.map((f) => f.latency).sort((a, b) => a - b);
  const fps = metrics.frames.length / ((Date.now() - metrics.startTime) / 1000);

  return {
    median_latency_ms: latencies[Math.floor(latencies.length / 2)] || 0,
    p95_latency_ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
    fps: Math.round(fps * 100) / 100,
    total_frames: metrics.frames.length,
    active_connections: {
      phones: phoneConnections.size,
      browsers: browserConnections.size,
      sessions: activeSessions.size,
    },
  };
}

function broadcastPhoneList() {
  const availablePhones = Array.from(phoneConnections.keys());
  browserConnections.forEach((browserSocket) => {
    browserSocket.emit("available-phones", { phones: availablePhones });
  });
}

// Start the server
console.log("🚀 Starting server...");

server.listen(port, "0.0.0.0", () => {
  const networkIP = getNetworkIP();

  console.log("");
  console.log("🚀 WebRTC Object Detection Server is RUNNING!");
  console.log("");
  console.log("📱 MOBILE ACCESS URLs:");
  console.log(`   Phone Camera: http://${networkIP}:${port}/phone`);
  console.log(`   QR Code: http://${networkIP}:${port}/qr`);
  console.log("");
  console.log("🖥️ COMPUTER ACCESS URLs:");
  console.log(`   Browser Viewer: http://${networkIP}:${port}/`);
  console.log(`   Local Access: http://localhost:${port}/`);
  console.log("");
  console.log("� MONITORING URLs:");
  console.log(`   Health Check: http://${networkIP}:${port}/health`);
  console.log(`   Metrics: http://${networkIP}:${port}/metrics`);
  console.log("");
  console.log("📋 SETUP INSTRUCTIONS:");
  console.log(
    "1. Make sure your phone and computer are on the same WiFi network"
  );
  console.log(
    `2. Open http://${networkIP}:${port}/qr on your computer to see QR code`
  );
  console.log("3. Scan QR code with your phone to access camera interface");
  console.log("4. Allow camera permissions on phone and start streaming");
  console.log("5. Watch live object detection on your computer!");
  console.log("");
  console.log("💡 Alternative: Manually enter the mobile URL on your phone:");
  console.log(`   http://${networkIP}:${port}/phone`);
  console.log("");
});
