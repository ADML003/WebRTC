export async function GET() {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "WebRTC Signaling Server - Vercel",
    version: "2.1.0",
    environment: process.env.NODE_ENV || "development",
    vercel_region: process.env.VERCEL_REGION || "unknown",
    vercel_url: process.env.VERCEL_URL || "localhost",
  });
}
