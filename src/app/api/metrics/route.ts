export async function GET() {
  return Response.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    service: 'WebRTC HTTP Signaling'
  });
}