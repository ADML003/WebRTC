'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function BrowserViewer() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [availablePhones, setAvailablePhones] = useState<string[]>([]);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Ready');
  const [metrics, setMetrics] = useState({
    fps: 0,
    latency: 0,
    objects: 0,
    frames: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('🖥️ Connected to server');
      newSocket.emit('browser-connect', {});
    });

    newSocket.on('browser-connected', (data) => {
      console.log('🖥️ Browser registered:', data.browserId);
      setConnectionStatus('Connected to server');
    });

    newSocket.on('available-phones', (data) => {
      setAvailablePhones(data.phones);
      console.log('📱 Available phones:', data.phones);
    });

    newSocket.on('webrtc-answer', async (data) => {
      console.log('📡 Received WebRTC answer');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer);
      }
    });

    newSocket.on('webrtc-ice-candidate', (data) => {
      if (peerConnectionRef.current) {
        console.log('📡 Browser received ICE candidate:', data.candidate.type);
        peerConnectionRef.current.addIceCandidate(data.candidate)
          .then(() => console.log('✅ ICE candidate added successfully'))
          .catch(err => console.error('❌ Error adding ICE candidate:', err));
      }
    });

    newSocket.on('webrtc-error', (data) => {
      console.error('❌ WebRTC error:', data.error);
      setConnectionStatus(`Error: ${data.error}`);
    });

    newSocket.on('detection-result', (result) => {
      drawDetections(result.detections);
      updateMetrics(result);
    });

    return () => {
      newSocket.disconnect();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const connectToPhone = async (phoneId: string) => {
    if (!socket) return;

    try {
      setConnectionStatus('Connecting to phone...');
      
      // Create peer connection with TURN servers for NAT traversal
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          // Free STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          // Free TURN servers (these help with NAT traversal)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject', 
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all', // Allow both STUN and TURN
      });

      peerConnectionRef.current = peerConnection;

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('📹 Received remote stream');
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
        setConnectionStatus('Connected - receiving video');
        setConnectedPhone(phoneId);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('📡 Browser sending ICE candidate:', event.candidate.type, event.candidate.candidate);
          socket.emit('webrtc-ice-candidate', {
            targetId: phoneId,
            candidate: event.candidate,
          });
        } else {
          console.log('📡 Browser ICE gathering completed');
        }
      };

      // Handle ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log('🧊 Browser ICE gathering state:', peerConnection.iceGatheringState);
      };

      // Handle ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 Browser ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          console.log('❌ ICE connection failed - retrying...');
          setConnectionStatus('Connection failed - retrying...');
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sessionId = `session_${Date.now()}`;
      socket.emit('webrtc-offer', {
        targetId: phoneId,
        offer: offer,
        sessionId: sessionId,
      });

      console.log('📡 WebRTC offer sent to phone:', phoneId);
    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionStatus('Connection failed');
    }
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnectedPhone(null);
    setConnectionStatus('Disconnected');
  };

  const drawDetections = (detections: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detections
    detections.forEach((detection) => {
      const x = detection.xmin * canvas.width;
      const y = detection.ymin * canvas.height;
      const width = (detection.xmax - detection.xmin) * canvas.width;
      const height = (detection.ymax - detection.ymin) * canvas.height;

      // Draw bounding box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // Draw label
      ctx.fillStyle = '#00ff00';
      ctx.font = '16px Arial';
      const label = `${detection.label} ${Math.round(detection.score * 100)}%`;
      ctx.fillText(label, x, y - 5);
    });

    setMetrics(prev => ({ ...prev, objects: detections.length }));
  };

  const updateMetrics = (result: any) => {
    setMetrics(prev => ({
      ...prev,
      latency: result.inference_ts - result.capture_ts,
      frames: prev.frames + 1,
    }));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-black/90 p-4 text-center border-b border-gray-800">
        <h2 className="text-xl font-bold">🖥️ WebRTC Object Detection Viewer</h2>
        <p>Receive live video from phone and perform real-time AI object detection</p>
      </div>

      <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          autoPlay
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          width={1280}
          height={720}
        />

        {/* Controls */}
        <div className="absolute top-5 left-5 z-10 flex flex-col gap-2">
          <button
            onClick={() => setAvailablePhones([])}
            className="px-4 py-2 bg-black/80 text-white border border-gray-600 rounded hover:bg-white/10"
          >
            🔄 Refresh Phones
          </button>

          {availablePhones.length > 0 && !connectedPhone && (
            <div className="bg-black/80 border border-gray-600 rounded max-h-48 overflow-y-auto">
              {availablePhones.map((phoneId) => (
                <div
                  key={phoneId}
                  onClick={() => connectToPhone(phoneId)}
                  className="p-3 cursor-pointer border-b border-gray-700 hover:bg-white/10 last:border-b-0"
                >
                  📱 {phoneId.substring(0, 8)}...
                </div>
              ))}
            </div>
          )}

          {connectedPhone && (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-600 text-white border border-red-500 rounded hover:bg-red-700"
            >
              ❌ Disconnect
            </button>
          )}
        </div>

        {/* Status */}
        <div className="absolute top-5 right-5 bg-black/80 p-4 rounded border border-gray-600">
          <div><strong>Status:</strong> {connectionStatus}</div>
          <div>{connectedPhone ? `Connected to: ${connectedPhone.substring(0, 8)}...` : 'No connection'}</div>
        </div>

        {/* Metrics */}
        <div className="absolute bottom-5 right-5 bg-black/80 p-4 rounded border border-gray-600 text-sm">
          <div><strong>Performance:</strong></div>
          <div>FPS: {metrics.fps}</div>
          <div>Latency: {metrics.latency}ms</div>
          <div>Objects: {metrics.objects}</div>
          <div>Frames: {metrics.frames}</div>
        </div>
      </div>
    </div>
  );
}