// HTTP-based WebRTC signaling server for Vercel deployment
// Using global objects with extended timeouts and better persistence

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
  type: "phone" | "browser";
  timestamp: number;
}

// Use global objects to persist across function calls within the same instance
declare global {
  var globalSessions: Map<string, Session> | undefined;
  var globalDevices: Map<string, Device> | undefined;
}

// Initialize or reuse global storage
const sessions = globalThis.globalSessions ?? new Map<string, Session>();
const devices = globalThis.globalDevices ?? new Map<string, Device>();

if (process.env.NODE_ENV === "development") {
  globalThis.globalSessions = sessions;
  globalThis.globalDevices = devices;
}

// Cleanup function - called manually instead of setInterval (which doesn't work on Vercel)
function cleanupExpiredData() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes (increased from 5)

  let sessionsCleaned = 0;
  let devicesCleaned = 0;

  for (const [id, session] of sessions.entries()) {
    if (now - session.timestamp > maxAge) {
      sessions.delete(id);
      sessionsCleaned++;
    }
  }

  for (const [id, device] of devices.entries()) {
    if (now - device.timestamp > maxAge) {
      devices.delete(id);
      devicesCleaned++;
    }
  }

  console.log(
    `Cleanup: removed ${sessionsCleaned} sessions and ${devicesCleaned} devices`
  );
}

export async function POST(request: Request) {
  try {
    // Clean up expired data on each request (since setInterval doesn't work on Vercel)
    cleanupExpiredData();

    const body = await request.json();
    const { type, data, sessionId, deviceId } = body;

    console.log(`Signaling POST: ${type}`, {
      sessionId,
      deviceId,
      sessionsCount: sessions.size,
      devicesCount: devices.size,
    });

    switch (type) {
      case "register":
        devices.set(deviceId, {
          id: deviceId,
          type: data.deviceType,
          timestamp: Date.now(),
        });

        console.log(`Device registered: ${deviceId} (${data.deviceType})`);

        if (data.deviceType === "browser") {
          const availablePhones = Array.from(devices.entries())
            .filter(([, device]) => device.type === "phone")
            .map(([id]) => id);
          console.log("Available phones for browser:", availablePhones);
          return Response.json({ success: true, deviceId, availablePhones });
        }

        return Response.json({ success: true, deviceId });

      case "offer":
        const session: Session = {
          id: sessionId,
          offer: data.offer,
          browser: deviceId,
          phone: data.targetId,
          iceCandidates: [],
          timestamp: Date.now(),
        };
        sessions.set(sessionId, session);
        console.log(
          `Offer stored: ${sessionId} from ${deviceId} to ${data.targetId}`
        );
        return Response.json({ success: true });

      case "answer":
        if (sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          session.answer = data.answer;
          session.timestamp = Date.now(); // Update timestamp
          sessions.set(sessionId, session);
          console.log(`Answer stored: ${sessionId}`);
          return Response.json({ success: true });
        }
        console.error(`Session not found for answer: ${sessionId}`);
        return Response.json({ error: "Session not found" }, { status: 404 });

      case "ice-candidate":
        if (sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          session.iceCandidates.push(data.candidate);
          session.timestamp = Date.now(); // Update timestamp
          sessions.set(sessionId, session);
          console.log(
            `ICE candidate added: ${sessionId} (total: ${session.iceCandidates.length})`
          );
          return Response.json({ success: true });
        }
        console.error(`Session not found for ICE candidate: ${sessionId}`);
        return Response.json({ error: "Session not found" }, { status: 404 });

      default:
        return Response.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Signaling POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Clean up expired data on each request (since setInterval doesn't work on Vercel)
    cleanupExpiredData();

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const sessionId = url.searchParams.get("sessionId");
    const deviceId = url.searchParams.get("deviceId");

    console.log(`Signaling GET: ${type}`, {
      sessionId,
      deviceId,
      sessionsCount: sessions.size,
      devicesCount: devices.size,
    });

    switch (type) {
      case "poll-offer":
        // Phone polls for offers
        for (const [id, session] of sessions.entries()) {
          if (session.phone === deviceId && session.offer && !session.answer) {
            console.log(`Found offer for phone ${deviceId}: session ${id}`);
            return Response.json({
              sessionId: id,
              offer: session.offer,
              browser: session.browser,
            });
          }
        }
        return Response.json({ offer: null });

      case "poll-answer":
        // Browser polls for answers
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          if (session.answer) {
            console.log(`Found answer for session ${sessionId}`);
            return Response.json({ answer: session.answer });
          }
        }
        return Response.json({ answer: null });

      case "poll-ice":
        // Poll for ICE candidates
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          const candidates = session.iceCandidates.splice(0); // Get and clear
          session.timestamp = Date.now(); // Update timestamp
          sessions.set(sessionId, session);
          if (candidates.length > 0) {
            console.log(
              `Retrieved ${candidates.length} ICE candidates for session ${sessionId}`
            );
          }
          return Response.json({ candidates });
        }
        return Response.json({ candidates: [] });

      case "available-phones":
        const availablePhones = Array.from(devices.entries())
          .filter(([, device]) => device.type === "phone")
          .map(([id]) => id);
        console.log(
          `Available phones requested: ${availablePhones.length} found`
        );
        return Response.json({ phones: availablePhones });

      default:
        return Response.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Signaling GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Configure serverless function timeout for Vercel
export const maxDuration = 10;
