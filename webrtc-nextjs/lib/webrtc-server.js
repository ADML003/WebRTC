const os = require('os');

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

// Connection tracking
const phoneConnections = new Map();
const browserConnections = new Map();
const activeSessions = new Map();

// Metrics
const metrics = {
  frames: [],
  startTime: Date.now(),
};

function setupSocketHandlers(io) {
  console.log("🔌 Setting up WebSocket handlers...");

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
      console.log(`✅ Found target phone, forwarding offer`);
      target.emit("webrtc-offer", {
        fromId: socket.id,
        offer: data.offer,
        sessionId: data.sessionId,
      });

      activeSessions.set(data.sessionId, {
        browser: socket.id,
        phone: data.targetId,
      });
      console.log(`📋 Session ${data.sessionId} created`);
    } else {
      console.log(`❌ Target phone ${data.targetId} not found`);
      socket.emit('webrtc-error', { error: 'Phone not found' });
    }
  });

      socket.on("webrtc-answer", (data) => {
    console.log(`📡 WebRTC answer: ${socket.id} -> ${data.targetId}`);
    const target = browserConnections.get(data.targetId);
    if (target) {
      console.log(`✅ Found target browser, forwarding answer`);
      target.emit("webrtc-answer", {
        fromId: socket.id,
        answer: data.answer,
        sessionId: data.sessionId,
      });
    } else {
      console.log(`❌ Target browser ${data.targetId} not found`);
    }
  });

      socket.on("webrtc-ice-candidate", (data) => {
    console.log(`📡 ICE candidate: ${socket.id} -> ${data.targetId}`, data.candidate.type);
    const target =
      phoneConnections.get(data.targetId) ||
      browserConnections.get(data.targetId);
    if (target) {
      console.log(`✅ Forwarding ICE candidate`);
      target.emit("webrtc-ice-candidate", {
        fromId: socket.id,
        candidate: data.candidate,
      });
    } else {
      console.log(`❌ Target for ICE candidate not found: ${data.targetId}`);
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

  function broadcastPhoneList() {
    const availablePhones = Array.from(phoneConnections.keys());
    browserConnections.forEach((browserSocket) => {
      browserSocket.emit("available-phones", { phones: availablePhones });
    });
  }
}

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

function setupMetrics() {
  // Initialize metrics tracking
  console.log("📊 Metrics system initialized");
}

module.exports = {
  setupSocketHandlers,
  setupMetrics,
  getMetrics,
  getNetworkIP,
  phoneConnections,
  browserConnections,
  activeSessions,
};
