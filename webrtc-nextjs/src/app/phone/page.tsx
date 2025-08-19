'use client';

import { useEffect, useRef, useState } from 'react';

export default function PhoneCamera() {
  const [phoneId, setPhoneId] = useState<string>('');
  const [status, setStatus] = useState('Ready to start camera');
  const [showInstructions, setShowInstructions] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
    const id = 'phone_' + Math.random().toString(36).substr(2, 9);
    setPhoneId(id);
  }, []);

  // Register phone when ID is available
  useEffect(() => {
    if (!phoneId || !isClient) return;

    const registerPhone = async () => {
      try {
        await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'register',
            deviceId: phoneId,
            data: { deviceType: 'phone' }
          })
        });
        
        console.log('📱 Phone registered:', phoneId);
      } catch (error) {
        console.error('Registration error:', error);
      }
    };

    registerPhone();
  }, [phoneId, isClient]);

  const startCamera = async () => {
    try {
      setStatus('Starting camera...');
      setShowInstructions(false);

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      setStatus('Camera started - Waiting for browser connection...');

      // Start polling for WebRTC offers
      startPollingForOffers();

    } catch (error) {
      console.error('Camera error:', error);
      setStatus('Failed to start camera. Please allow camera permissions and try again.');
      setShowInstructions(true);
    }
  };

  const startPollingForOffers = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/signaling?type=poll-offer&deviceId=${phoneId}`);
        const data = await response.json();

        if (data.offer && data.sessionId) {
          console.log('📡 Received WebRTC offer from browser');
          await handleOffer(data);
        }
      } catch (error) {
        console.error('Error polling for offers:', error);
      }
    }, 1000); // Poll every second
  };

  const handleOffer = async (data: { offer: RTCSessionDescriptionInit; sessionId: string; browser: string }) => {
    try {
      setStatus('Connecting to browser...');

      if (!localStreamRef.current) {
        setStatus('ERROR: Start camera first!');
        return;
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
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
        ],
        bundlePolicy: 'balanced',
        iceTransportPolicy: 'all',
      });

      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      localStreamRef.current.getTracks().forEach((track) => {
        console.log('📹 Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, localStreamRef.current!);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'ice-candidate',
                sessionId: data.sessionId,
                deviceId: phoneId,
                data: { candidate: event.candidate }
              })
            });
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('🔗 Connection state:', state);
        
        if (state === 'connected') {
          setStatus('Connected to browser! 📹');
        } else if (state === 'failed' || state === 'disconnected') {
          setStatus('Connection lost - Waiting for new connection...');
        }
      };

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back
      const response = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'answer',
          sessionId: data.sessionId,
          deviceId: phoneId,
          data: { answer }
        })
      });

      if (response.ok) {
        console.log('📡 WebRTC answer sent to browser');
        setStatus('Connected to browser! 📹');
      } else {
        throw new Error('Failed to send answer');
      }

    } catch (error) {
      console.error('Error handling offer:', error);
      setStatus('Connection failed');
    }
  };

  const stopStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setStatus('Camera stopped');
    setShowInstructions(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  // Show loading state during hydration to prevent mismatch
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-6">
            📱 Phone Camera
          </h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">
          📱 Phone Camera
        </h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p className="text-lg mb-4">{status}</p>
          <p className="text-sm text-gray-400 font-mono">Phone ID: {phoneId}</p>
        </div>

        {/* Camera Preview */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">📹 Camera Preview</h3>
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <div>Camera not started</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex gap-4">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg text-lg"
              >
                📹 Start Camera
              </button>
            ) : (
              <button
                onClick={stopStream}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg text-lg"
              >
                ⏹️ Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">📋 Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click &quot;Start Camera&quot; to begin streaming</li>
              <li>Allow camera permissions when prompted</li>
              <li>Open the browser viewer page on your computer</li>
              <li>Your phone should appear in the available devices list</li>
              <li>Click &quot;Connect&quot; on the browser to establish connection</li>
              <li>Your camera feed should appear on the browser</li>
            </ol>
          </div>
        )}

        {isStreaming && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">✅ Camera Active</h3>
            <p className="text-sm">
              Your camera is now active and ready to connect to browsers. 
              Keep this page open while using the browser viewer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}