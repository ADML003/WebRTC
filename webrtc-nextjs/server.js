// Custom server for Railway deployment
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT) || 3000;

console.log(`🚀 Starting server in ${dev ? "development" : "production"} mode`);
console.log(`📡 Binding to ${hostname}:${port}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(
  `🔧 Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || "Not set"}`
);

// Add timeout and keep-alive settings
const serverOptions = {
  timeout: 30000, // 30 seconds
  keepAliveTimeout: 5000, // 5 seconds
  headersTimeout: 10000, // 10 seconds
};

const app = next({
  dev,
  hostname,
  port,
  customServer: true,
  conf: {
    poweredByHeader: false,
    compress: true,
    experimental: {
      serverComponentsExternalPackages: [],
    },
  },
});

const handle = app.getRequestHandler();

console.log("📦 Preparing Next.js application...");

app
  .prepare()
  .then(() => {
    console.log("✅ Next.js application prepared");

    const server = createServer(async (req, res) => {
      try {
        // Set response timeout
        res.setTimeout(25000, () => {
          console.warn("⚠️ Request timeout:", req.url);
          if (!res.headersSent) {
            res.statusCode = 504;
            res.end("Request timeout");
          }
        });

        // Add CORS headers for WebRTC
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        );

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("❌ Error occurred handling", req.url, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("internal server error");
        }
      }
    });

    // Apply server options
    Object.assign(server, serverOptions);

    server.on("error", (err) => {
      console.error("❌ Server error:", err);
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${port} is already in use`);
        process.exit(1);
      }
    });

    server.on("clientError", (err, socket) => {
      console.error("❌ Client error:", err.message);
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    });

    // Start listening
    console.log(`🔗 Attempting to bind to ${hostname}:${port}...`);

    server.listen(port, hostname, () => {
      console.log(`✅ Server successfully started!`);
      console.log(`🌐 Local: http://${hostname}:${port}`);
      console.log(
        `🌐 Railway: https://${
          process.env.RAILWAY_PUBLIC_DOMAIN ||
          "webrtc-production-bd78.up.railway.app"
        }`
      );
      console.log(`🔍 Health: http://${hostname}:${port}/api/health`);
      console.log(`📊 Process ID: ${process.pid}`);
      console.log(
        `💾 Memory usage: ${Math.round(
          process.memoryUsage().heapUsed / 1024 / 1024
        )}MB`
      );
    });
  })
  .catch((err) => {
    console.error("❌ Failed to prepare Next.js application:", err);
    process.exit(1);
  });

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);

  // Close server and exit
  const timeout = setTimeout(() => {
    console.log("❌ Forceful shutdown due to timeout");
    process.exit(1);
  }, 10000); // 10 seconds timeout for graceful shutdown

  // Clear timeout and exit
  clearTimeout(timeout);
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
