export async function GET() {
  return Response.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'WebRTC Signaling Server',
    version: '2.0.0'
  });
}