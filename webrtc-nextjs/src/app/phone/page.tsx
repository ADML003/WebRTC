'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function PhoneCamera() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [phoneId, setPhoneId] = useState<string>('');
  const [status, setStatus] = useState('Ready to connect');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('📱 Connected to server');
      newSocket.emit('phone-connect', {});
    });

    newSocket.on('phone-connected', (data) => {
      setPhoneId(data.phoneId);
      setStatus('Connected to server');
      console.log('📱 Phone registered:', data.phoneId);
    });

    newSocket.on('webrtc-offer', async (data) => {
      console.log('📡 Received WebRTC offer from browser');
      await handleOffer(data);
    });

    newSocket.on('webrtc-ice-candidate', (data) => {
      handleIceCandidate(data);
    });

    return () => {
      stopStream();
      newSocket.disconnect();
    };
  }, []);

  const startCamera = async () => {
    try {
      setStatus('Starting camera...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('Camera ready - waiting for browser connection');
      console.log('📹 Camera started');
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      setStatus('Camera access failed');
      alert('Camera access failed. Please ensure you have given permission and try again.');
    }
  };

  const waitForConnection = () => {
    setStatus('Waiting for browser connection...');
    setShowInstructions(true);
    console.log('📱 Ready for WebRTC connection. Phone ID:', phoneId);
  };

  const handleOffer = async (data: any) => {
    try {
      setStatus('Connecting to browser...');
      setShowInstructions(false);

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

      // Add local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('📡 Sending ICE candidate:', event.candidate.type, event.candidate.candidate);
          socket.emit('webrtc-ice-candidate', {
            targetId: data.fromId,
            candidate: event.candidate,
          });
        } else if (!event.candidate) {
          console.log('📡 ICE gathering completed');
        }
      };

      // Handle ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log('🧊 ICE gathering state:', peerConnection.iceGatheringState);
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('📡 Connection state:', state);

        if (state === 'connected') {
          setStatus('Streaming to browser!');
          setIsStreaming(true);
        } else if (state === 'connecting') {
          setStatus('Establishing connection...');
        } else if (state === 'disconnected' || state === 'failed') {
          setStatus('Connection lost');
          setIsStreaming(false);
        }
      };

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back
      if (socket) {
        socket.emit('webrtc-answer', {
          targetId: data.fromId,
          answer: answer,
          sessionId: data.sessionId,
        });
      }

      console.log('📡 WebRTC answer sent');
    } catch (error) {
      console.error('❌ WebRTC setup failed:', error);
      setStatus('Connection failed - try again');
    }
  };

  const handleIceCandidate = (data: any) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current
        .addIceCandidate(data.candidate)
        .then(() => console.log('📡 ICE candidate added'))
        .catch((err) => console.error('❌ ICE candidate error:', err));
    }
  };

  const stopStream = () => {
    setIsStreaming(false);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus('Stream stopped');
    setShowInstructions(false);
    console.log('⏹️ Stream stopped');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="bg-black/80 p-3 text-center z-10">
        <h2 className="text-lg font-bold">📱 Phone Camera Stream</h2>
        <p className="text-sm">Share your camera with browser for AI detection</p>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />

        <div className="absolute top-5 left-5 bg-black/70 p-2 rounded text-xs">
          Phone ID: {phoneId.substring(0, 8)}...
        </div>

        <div className="absolute top-5 right-5 bg-black/70 p-2 rounded text-xs">
          {status}
        </div>

        {showInstructions && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-100 text-black p-4 rounded-lg max-w-sm">
            <strong className="block mb-2">📋 Next Steps:</strong>
            <div className="text-sm space-y-1">
              <div>1. Open the browser viewer on your computer</div>
              <div>2. Click "Connect to Phone"</div>
              <div>3. Select your phone ID: <code className="bg-gray-200 px-1 rounded">{phoneId.substring(0, 8)}...</code></div>
              <div>4. Wait for connection to establish</div>
            </div>
          </div>
        )}

        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-10">
          {!localStreamRef.current && (
            <button
              onClick={startCamera}
              className="px-6 py-3 bg-black/70 text-white rounded-full text-lg min-w-[120px] active:bg-white/20"
            >
              Start Camera
            </button>
          )}

          {localStreamRef.current && !isStreaming && (
            <button
              onClick={waitForConnection}
              className="px-6 py-3 bg-black/70 text-white rounded-full text-lg min-w-[120px] active:bg-white/20"
            >
              Connect to Browser
            </button>
          )}

          {isStreaming && (
            <button
              onClick={stopStream}
              className="px-6 py-3 bg-red-600 text-white rounded-full text-lg min-w-[120px] active:bg-red-700"
            >
              Stop Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
