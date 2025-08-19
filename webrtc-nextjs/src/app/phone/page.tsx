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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-3 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-2">
              📱 Phone Camera
            </h1>
            <p className="text-gray-400 text-sm md:text-base">Stream your camera to the browser</p>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⚡</div>
              <div className="text-xl">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-3 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-2">
            📱 Phone Camera
          </h1>
          <p className="text-gray-400 text-sm md:text-base">Stream your camera to the browser</p>
        </div>
        
        {/* Status Card - Compact and mobile-optimized */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-sm md:text-base font-medium">{status}</span>
            </div>
            {isStreaming && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs">LIVE</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-2">ID: {phoneId}</p>
        </div>

        {/* Camera Preview - Much wider and more prominent */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-3 md:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-2xl font-semibold flex items-center gap-2">
              📹 <span>Camera Preview</span>
            </h3>
            {isStreaming && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">STREAMING</span>
              </div>
            )}
          </div>
          
          {/* Wider camera container - takes full width */}
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center p-6">
                  <div className="text-5xl md:text-7xl mb-4 opacity-50">📷</div>
                  <div className="text-lg md:text-xl mb-2">Camera not started</div>
                  <div className="text-sm text-gray-500">Tap the button below to begin</div>
                </div>
              </div>
            )}
            {/* Camera overlay effects */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 pointer-events-none"></div>
            
            {/* Corner indicators */}
            {isStreaming && (
              <>
                <div className="absolute top-3 left-3 w-4 h-4 border-l-2 border-t-2 border-green-400/50"></div>
                <div className="absolute top-3 right-3 w-4 h-4 border-r-2 border-t-2 border-green-400/50"></div>
                <div className="absolute bottom-3 left-3 w-4 h-4 border-l-2 border-b-2 border-green-400/50"></div>
                <div className="absolute bottom-3 right-3 w-4 h-4 border-r-2 border-b-2 border-green-400/50"></div>
              </>
            )}
          </div>
        </div>

        {/* Controls - Large, mobile-friendly buttons */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 mb-4">
          <div className="flex gap-3">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold py-4 px-6 rounded-xl text-base md:text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
              >
                <span className="flex items-center justify-center gap-2">
                  📹 <span>Start Camera</span>
                </span>
              </button>
            ) : (
              <button
                onClick={stopStream}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-4 px-6 rounded-xl text-base md:text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
              >
                <span className="flex items-center justify-center gap-2">
                  ⏹️ <span>Stop Camera</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Instructions - Compact and mobile-optimized */}
        {showInstructions && (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-2xl p-4">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-blue-300">
              ⚡ <span>Quick Start</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-200/80">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span>Tap &quot;Start Camera&quot; above</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                <span>Allow camera permissions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                <span>Open browser viewer on computer</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">4.</span>
                <span>Click Connect to stream</span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && (
          <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="text-base font-semibold text-green-300">Camera Active</h3>
            </div>
            <p className="text-sm text-green-200/80">
              Your camera is streaming and ready for browser connections. Keep this page open!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}