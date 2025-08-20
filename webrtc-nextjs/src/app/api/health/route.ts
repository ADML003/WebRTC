export async function GET() {
  return Response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "WebRTC Signaling Server",
    version: "2.0.0",
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    railway_domain: process.env.RAILWAY_PUBLIC_DOMAIN || "Not set",
    hostname: process.env.HOSTNAME || "0.0.0.0",
  });
}
