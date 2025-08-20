// WebRTC signaling server using Vercel KV (Redis) for persistent storage
import { kv } from '@vercel/kv';

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

// Helper functions for KV operations
async function getSession(sessionId: string): Promise<Session | null> {
  try {
    return await kv.get(`session:${sessionId}`);
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

async function setSession(sessionId: string, session: Session): Promise<void> {
  try {
    await kv.set(`session:${sessionId}`, session, { ex: 300 }); // Expire in 5 minutes
  } catch (error) {
    console.error('Error setting session:', error);
  }
}

async function getDevice(deviceId: string): Promise<Device | null> {
  try {
    return await kv.get(`device:${deviceId}`);
  } catch (error) {
    console.error('Error getting device:', error);
    return null;
  }
}

async function setDevice(deviceId: string, device: Device): Promise<void> {
  try {
    await kv.set(`device:${deviceId}`, device, { ex: 300 }); // Expire in 5 minutes
  } catch (error) {
    console.error('Error setting device:', error);
  }
}

async function getAllDevices(): Promise<Device[]> {
  try {
    const keys = await kv.keys('device:*');
    const devices: Device[] = [];
    
    for (const key of keys) {
      const device = await kv.get<Device>(key);
      if (device) devices.push(device);
    }
    
    return devices;
  } catch (error) {
    console.error('Error getting all devices:', error);
    return [];
  }
}

async function getAllSessions(): Promise<Session[]> {
  try {
    const keys = await kv.keys('session:*');
    const sessions: Session[] = [];
    
    for (const key of keys) {
      const session = await kv.get<Session>(key);
      if (session) sessions.push(session);
    }
    
    return sessions;
  } catch (error) {
    console.error('Error getting all sessions:', error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data, sessionId, deviceId } = body;

    console.log(`Signaling POST: ${type}`, { sessionId, deviceId });

    switch (type) {
      case 'register':
        const device: Device = {
          id: deviceId,
          type: data.deviceType,
          timestamp: Date.now()
        };
        
        await setDevice(deviceId, device);
        
        if (data.deviceType === 'browser') {
          const allDevices = await getAllDevices();
          const availablePhones = allDevices
            .filter(device => device.type === 'phone')
            .map(device => device.id);
          
          console.log('Available phones:', availablePhones);
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
        
        await setSession(sessionId, session);
        console.log('Offer stored for session:', sessionId);
        return Response.json({ success: true });

      case 'answer':
        const existingSession = await getSession(sessionId);
        if (existingSession) {
          existingSession.answer = data.answer;
          existingSession.timestamp = Date.now(); // Update timestamp
          await setSession(sessionId, existingSession);
          console.log('Answer stored for session:', sessionId);
          return Response.json({ success: true });
        }
        console.error('Session not found for answer:', sessionId);
        return Response.json({ error: 'Session not found' }, { status: 404 });

      case 'ice-candidate':
        const sessionForIce = await getSession(sessionId);
        if (sessionForIce) {
          sessionForIce.iceCandidates.push(data.candidate);
          sessionForIce.timestamp = Date.now(); // Update timestamp
          await setSession(sessionId, sessionForIce);
          console.log('ICE candidate added to session:', sessionId);
          return Response.json({ success: true });
        }
        console.error('Session not found for ICE candidate:', sessionId);
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
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const sessionId = url.searchParams.get('sessionId');
    const deviceId = url.searchParams.get('deviceId');

    console.log(`Signaling GET: ${type}`, { sessionId, deviceId });

    switch (type) {
      case 'poll-offer':
        // Phone polls for offers
        const allSessions = await getAllSessions();
        const offerSession = allSessions.find(session => 
          session.phone === deviceId && session.offer && !session.answer
        );
        
        if (offerSession) {
          console.log('Found offer for device:', deviceId);
          return Response.json({ 
            sessionId: offerSession.id, 
            offer: offerSession.offer,
            browser: offerSession.browser 
          });
        }
        
        return Response.json({ offer: null });

      case 'poll-answer':
        // Browser polls for answers
        if (sessionId) {
          const session = await getSession(sessionId);
          if (session?.answer) {
            console.log('Found answer for session:', sessionId);
            return Response.json({ answer: session.answer });
          }
        }
        return Response.json({ answer: null });

      case 'poll-ice':
        // Poll for ICE candidates
        if (sessionId) {
          const session = await getSession(sessionId);
          if (session) {
            const candidates = session.iceCandidates.splice(0); // Get and clear
            session.timestamp = Date.now(); // Update timestamp
            await setSession(sessionId, session);
            console.log(`Retrieved ${candidates.length} ICE candidates for session:`, sessionId);
            return Response.json({ candidates });
          }
        }
        return Response.json({ candidates: [] });

      case 'available-phones':
        const allDevices = await getAllDevices();
        const availablePhones = allDevices
          .filter(device => device.type === 'phone')
          .map(device => device.id);
        
        console.log('Available phones requested:', availablePhones);
        return Response.json({ phones: availablePhones });

      default:
        return Response.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Signaling GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
