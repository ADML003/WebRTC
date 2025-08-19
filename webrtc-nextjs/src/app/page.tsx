'use client';

import { useEffect, useRef, useState } from 'react';

export default function BrowserViewer() {
  const [availablePhones, setAvailablePhones] = useState<string[]>([]);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Ready');
  const [deviceId, setDeviceId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionIdRef = useRef<string>('');

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
    const id = 'browser_' + Math.random().toString(36).substr(2, 9);
    setDeviceId(id);
  }, []);

  // Register browser and poll for phones
  useEffect(() => {
    if (!deviceId || !isClient) return;

    const registerAndPoll = async () => {
      try {
        // Register as browser
        await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'register',
            deviceId,
            data: { deviceType: 'browser' }
          })
        });

        setConnectionStatus('Connected to server');

        // Start polling for available phones
        const pollPhones = async () => {
          try {
            const response = await fetch(`/api/signaling?type=available-phones`);
            const data = await response.json();
            setAvailablePhones(data.phones || []);
          } catch (error) {
            console.error('Error polling phones:', error);
          }
        };

        pollPhones(); // Initial poll
        pollingIntervalRef.current = setInterval(pollPhones, 2000); // Poll every 2 seconds
      } catch (error) {
        console.error('Registration error:', error);
        setConnectionStatus('Connection failed');
      }
    };

    registerAndPoll();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [deviceId, isClient]);

  const connectToPhone = async (phoneId: string) => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setConnectedPhone(phoneId);
    setConnectionStatus('Connecting...');

    try {
      // Disconnect existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Create new peer connection
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
      const sessionId = 'session_' + Date.now();
      currentSessionIdRef.current = sessionId;

      // Handle incoming video stream
      peerConnection.ontrack = (event) => {
        console.log('📡 Received video track from phone');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionStatus('Connected - Receiving video');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'ice-candidate',
                sessionId,
                deviceId,
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
          setConnectionStatus('Connected');
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionStatus('Connection failed');
          setConnectedPhone(null);
          setIsConnecting(false);
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });
      
      await peerConnection.setLocalDescription(offer);

      const response = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'offer',
          sessionId,
          deviceId,
          data: { offer, targetId: phoneId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send offer');
      }

      console.log('📡 WebRTC offer sent to phone:', phoneId);

      // Start polling for answer
      const pollForAnswer = async () => {
        try {
          const response = await fetch(`/api/signaling?type=poll-answer&sessionId=${sessionId}`);
          const data = await response.json();
          
          if (data.answer && peerConnection.signalingState === 'have-local-offer') {
            console.log('📡 Received WebRTC answer');
            await peerConnection.setRemoteDescription(data.answer);
            
            // Start polling for ICE candidates
            pollForIceCandidates();
            return true; // Stop polling for answer
          }
        } catch (error) {
          console.error('Error polling for answer:', error);
        }
        return false;
      };

      // Poll for answer every 1 second, max 30 seconds
      let answerPollCount = 0;
      const answerInterval = setInterval(async () => {
        answerPollCount++;
        const received = await pollForAnswer();
        
        if (received || answerPollCount > 30) {
          clearInterval(answerInterval);
          if (!received) {
            setConnectionStatus('Connection timeout');
            setConnectedPhone(null);
            setIsConnecting(false);
          }
        }
      }, 1000);

      // Poll for ICE candidates
      const pollForIceCandidates = () => {
        const iceInterval = setInterval(async () => {
          try {
            const response = await fetch(`/api/signaling?type=poll-ice&sessionId=${sessionId}`);
            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0) {
              for (const candidate of data.candidates) {
                if (peerConnection.remoteDescription) {
                  await peerConnection.addIceCandidate(candidate);
                }
              }
            }
          } catch (error) {
            console.error('Error polling ICE candidates:', error);
          }
        }, 1000);

        // Clean up ICE polling after 2 minutes
        setTimeout(() => clearInterval(iceInterval), 2 * 60 * 1000);
      };

    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('Connection failed');
      setConnectedPhone(null);
    }
    
    setIsConnecting(false);
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
    currentSessionIdRef.current = '';
  };

  // Show loading state during hydration to prevent mismatch
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            📹 WebRTC Browser Viewer
          </h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          📹 WebRTC Browser Viewer
        </h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Connection Status</h2>
          <p className="text-lg mb-4">Status: <span className="text-green-400">{connectionStatus}</span></p>
          {connectedPhone && (
            <p className="text-lg mb-4">Connected to: <span className="text-blue-400">{connectedPhone}</span></p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Display */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">📱 Phone Camera Feed</h3>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {!connectedPhone && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📱</div>
                    <div>No phone connected</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phone List */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">📱 Available Phones ({availablePhones.length})</h3>
            <div className="space-y-3">
              {availablePhones.length === 0 ? (
                <p className="text-gray-400">No phones available. Make sure a phone has opened the camera page.</p>
              ) : (
                availablePhones.map((phoneId) => (
                  <div key={phoneId} className="flex items-center justify-between bg-gray-700 rounded p-3">
                    <span className="font-mono text-sm">{phoneId}</span>
                    <button
                      onClick={() => connectToPhone(phoneId)}
                      disabled={isConnecting || connectedPhone === phoneId}
                      className={`px-4 py-2 rounded font-semibold ${
                        connectedPhone === phoneId
                          ? 'bg-green-600 text-white cursor-not-allowed'
                          : isConnecting
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {connectedPhone === phoneId ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {connectedPhone && (
              <button
                onClick={disconnect}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">📋 Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Open the <strong>/phone</strong> page on your mobile device</li>
            <li>Allow camera permissions and start the camera</li>
            <li>The phone should appear in the &quot;Available Phones&quot; list above</li>
            <li>Click &quot;Connect&quot; to establish a WebRTC connection</li>
            <li>You should see the phone&apos;s camera feed in the video player</li>
          </ol>
        </div>
      </div>
    </div>
  );
}