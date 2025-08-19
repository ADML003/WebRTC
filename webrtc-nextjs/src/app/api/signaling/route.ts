// HTTP-based WebRTC signaling server for Vercel deployment
// Using in-memory storage (in production, use Redis or database)

interface Session {
  id: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  browser?: string;
  phone?: string;
  iceCandidates: RTCIceCandidate[];
  timestamp: number;
}

interface Device {
  id: string;
  type: 'phone' | 'browser';
  timestamp: number;
}

// In-memory storage (Note: This will be reset on each serverless function call on Vercel)
// For production, use Redis or a database for persistent storage
const sessions = new Map<string, Session>();
const devices = new Map<string, Device>();

// Cleanup function - called manually instead of setInterval (which doesn't work on Vercel)
function cleanupExpiredData() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [id, session] of sessions.entries()) {
    if (now - session.timestamp > maxAge) {
      sessions.delete(id);
    }
  }
  
  for (const [id, device] of devices.entries()) {
    if (now - device.timestamp > maxAge) {
      devices.delete(id);
    }
  }
}

export async function POST(request: Request) {
  try {
    // Clean up expired data on each request (since setInterval doesn't work on Vercel)
    cleanupExpiredData();
    
    const body = await request.json();
    const { type, data, sessionId, deviceId } = body;

    switch (type) {
      case 'register':
        devices.set(deviceId, {
          id: deviceId,
          type: data.deviceType,
          timestamp: Date.now()
        });
        
        if (data.deviceType === 'browser') {
          const availablePhones = Array.from(devices.entries())
            .filter(([_, device]) => device.type === 'phone')
            .map(([id, _]) => id);
          return Response.json({ success: true, deviceId, availablePhones });
        }
        
        return Response.json({ success: true, deviceId });

      case 'offer':
        const session: Session = {
          id: sessionId,
          offer: data.offer,
          browser: deviceId,
          phone: data.targetId,
          iceCandidates: [],
          timestamp: Date.now()
        };
        sessions.set(sessionId, session);
        return Response.json({ success: true });

      case 'answer':
        if (sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          session.answer = data.answer;
          sessions.set(sessionId, session);
          return Response.json({ success: true });
        }
        return Response.json({ error: 'Session not found' }, { status: 404 });

      case 'ice-candidate':
        if (sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          session.iceCandidates.push(data.candidate);
          sessions.set(sessionId, session);
          return Response.json({ success: true });
        }
        return Response.json({ error: 'Session not found' }, { status: 404 });

      default:
        return Response.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Signaling POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Clean up expired data on each request (since setInterval doesn't work on Vercel)
    cleanupExpiredData();
    
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const sessionId = url.searchParams.get('sessionId');
    const deviceId = url.searchParams.get('deviceId');

    switch (type) {
      case 'poll-offer':
        // Phone polls for offers
        for (const [id, session] of sessions.entries()) {
          if (session.phone === deviceId && session.offer && !session.answer) {
            return Response.json({ 
              sessionId: id, 
              offer: session.offer,
              browser: session.browser 
            });
          }
        }
        return Response.json({ offer: null });

      case 'poll-answer':
        // Browser polls for answers
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          if (session.answer) {
            return Response.json({ answer: session.answer });
          }
        }
        return Response.json({ answer: null });

      case 'poll-ice':
        // Poll for ICE candidates
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          const candidates = session.iceCandidates.splice(0); // Get and clear
          sessions.set(sessionId, session);
          return Response.json({ candidates });
        }
        return Response.json({ candidates: [] });

      case 'available-phones':
        const availablePhones = Array.from(devices.entries())
          .filter(([, device]) => device.type === 'phone')
          .map(([id]) => id);
        return Response.json({ phones: availablePhones });

      default:
        return Response.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Signaling GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
