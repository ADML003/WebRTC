"use client";

import { useEffect, useRef, useState } from "react";

export default function BrowserViewer() {
  const [availablePhones, setAvailablePhones] = useState<string[]>([]);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Ready");
  const [deviceId, setDeviceId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionIdRef = useRef<string>("");

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
    const id = "browser_" + Math.random().toString(36).substr(2, 9);
    setDeviceId(id);
  }, []);

  // Register browser and poll for phones
  useEffect(() => {
    if (!deviceId || !isClient) return;

    const registerAndPoll = async () => {
      try {
        // Register as browser
        await fetch("/api/signaling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "register",
            deviceId,
            data: { deviceType: "browser" },
          }),
        });

        setConnectionStatus("Connected to server");

        // Start polling for available phones
        const pollPhones = async () => {
          try {
            const response = await fetch(
              `/api/signaling?type=available-phones`
            );
            const data = await response.json();
            setAvailablePhones(data.phones || []);
          } catch (error) {
            console.error("Error polling phones:", error);
          }
        };

        pollPhones(); // Initial poll
        pollingIntervalRef.current = setInterval(pollPhones, 2000); // Poll every 2 seconds
      } catch (error) {
        console.error("Registration error:", error);
        setConnectionStatus("Connection failed");
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
    setConnectionStatus("Connecting...");

    try {
      // Disconnect existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Create new peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        bundlePolicy: "max-bundle",
        iceTransportPolicy: "all",
      });

      peerConnectionRef.current = peerConnection;
      const sessionId = "session_" + Date.now();
      currentSessionIdRef.current = sessionId;

      // Handle incoming video stream with debugging
      peerConnection.ontrack = (event) => {
        console.log(
          "📡 Received video track from phone:",
          event.track.kind,
          event.track.enabled,
          event.track.readyState
        );
        console.log("📡 Streams received:", event.streams.length);

        if (videoRef.current && event.streams[0]) {
          console.log("📺 Setting video source to received stream");
          videoRef.current.srcObject = event.streams[0];

          // Ensure video plays
          videoRef.current.onloadedmetadata = () => {
            console.log("📺 Video metadata loaded, attempting to play");
            videoRef.current?.play().catch((error) => {
              console.error("❌ Video play failed:", error);
            });
          };

          setConnectionStatus("Connected - Receiving video feed");
        } else {
          console.warn("⚠️ No video ref or streams available");
        }
      };

      // Handle ICE candidates with retry mechanism
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log(
            "🧊 Sending ICE candidate from browser:",
            event.candidate.candidate
          );
          let retries = 3;
          while (retries > 0) {
            try {
              const response = await fetch("/api/signaling", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "ice-candidate",
                  sessionId,
                  deviceId,
                  data: { candidate: event.candidate },
                }),
              });

              if (response.ok) {
                console.log("✅ ICE candidate sent successfully");
                break;
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error) {
              retries--;
              console.error(
                `❌ Error sending ICE candidate (${retries} retries left):`,
                error
              );
              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
              }
            }
          }
        } else {
          console.log("🧊 ICE gathering complete for browser");
        }
      };

      // Handle connection state changes with detailed logging
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log("🔗 Browser connection state:", state);

        if (state === "connected") {
          setConnectionStatus("Connected - Video feed active");
          console.log("✅ Browser WebRTC connection established successfully");
        } else if (state === "failed") {
          console.error("❌ Browser WebRTC connection failed");
          setConnectionStatus("Connection failed");
          setConnectedPhone(null);
          setIsConnecting(false);
        } else if (state === "disconnected") {
          console.warn("⚠️ Browser WebRTC connection disconnected");
          setConnectionStatus("Connection lost");
          setConnectedPhone(null);
          setIsConnecting(false);
        } else if (state === "connecting") {
          setConnectionStatus("Establishing connection...");
        }
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        const iceState = peerConnection.iceConnectionState;
        console.log("🧊 Browser ICE connection state:", iceState);

        if (iceState === "failed") {
          console.error("❌ Browser ICE connection failed - restarting ICE");
          peerConnection.restartIce();
        } else if (iceState === "connected") {
          console.log("✅ Browser ICE connection established");
        }
      };

      // Create and send offer
      console.log("📡 Creating offer...");
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });

      await peerConnection.setLocalDescription(offer);
      console.log("📡 Local description set, sending offer...");

      const response = await fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "offer",
          sessionId,
          deviceId,
          data: { offer, targetId: phoneId },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send offer");
      }

      console.log("📡 WebRTC offer sent to phone:", phoneId);

      // Start polling for answer
      const pollForAnswer = async () => {
        try {
          const response = await fetch(
            `/api/signaling?type=poll-answer&sessionId=${sessionId}`
          );
          const data = await response.json();

          if (
            data.answer &&
            peerConnection.signalingState === "have-local-offer"
          ) {
            console.log("📡 Received WebRTC answer");
            await peerConnection.setRemoteDescription(data.answer);

            // Start polling for ICE candidates
            pollForIceCandidates();
            return true; // Stop polling for answer
          }
        } catch (error) {
          console.error("Error polling for answer:", error);
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
            setConnectionStatus("Connection timeout");
            setConnectedPhone(null);
            setIsConnecting(false);
          }
        }
      }, 1000);

      // Poll for ICE candidates
      const pollForIceCandidates = () => {
        const iceInterval = setInterval(async () => {
          try {
            const response = await fetch(
              `/api/signaling?type=poll-ice&sessionId=${sessionId}`
            );
            const data = await response.json();

            if (data.candidates && data.candidates.length > 0) {
              console.log(
                `📡 Received ${data.candidates.length} ICE candidates`
              );
              for (const candidate of data.candidates) {
                if (peerConnection.remoteDescription) {
                  await peerConnection.addIceCandidate(candidate);
                  console.log("🧊 Added ICE candidate");
                }
              }
            }
          } catch (error) {
            console.error("Error polling ICE candidates:", error);
          }
        }, 1000);

        // Clean up ICE polling after 2 minutes
        setTimeout(() => clearInterval(iceInterval), 2 * 60 * 1000);
      };
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("Connection failed");
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
    setConnectionStatus("Disconnected");
    currentSessionIdRef.current = "";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            📹 WebRTC Browser Viewer
          </h1>
          <p className="text-gray-400 text-lg">
            Real-time video streaming from your phone
          </p>
        </div>

        {/* Status Card - Compact */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  connectedPhone ? "bg-green-400 animate-pulse" : "bg-gray-500"
                }`}
              ></div>
              <span className="font-medium">
                Status:{" "}
                <span className="text-green-400">{connectionStatus}</span>
              </span>
            </div>
            {connectedPhone && (
              <div className="flex items-center gap-2 text-blue-400">
                <span className="text-sm">📱 Connected to:</span>
                <span className="font-mono text-xs bg-blue-500/20 px-2 py-1 rounded">
                  {connectedPhone}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Video takes priority */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Video Display - Wider and more prominent */}
          <div className="xl:col-span-2">
            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                  📱 <span>Live Camera Feed</span>
                </h3>
                {connectedPhone && (
                  <div className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">LIVE</span>
                  </div>
                )}
              </div>
              <div
                className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
                style={{ aspectRatio: "16/9" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!connectedPhone && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4 opacity-50">📱</div>
                      <div className="text-xl mb-2">No phone connected</div>
                      <div className="text-sm text-gray-500">
                        Connect a phone to see live video
                      </div>
                    </div>
                  </div>
                )}
                {/* Video overlay effects */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 pointer-events-none"></div>
              </div>
            </div>
          </div>

          {/* Phone List - Compact sidebar */}
          <div className="xl:col-span-1">
            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 md:p-6">
              <h3 className="text-lg md:text-xl font-semibold mb-4 flex items-center gap-2">
                📱 <span>Devices ({availablePhones.length})</span>
              </h3>

              <div className="space-y-3">
                {availablePhones.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2 opacity-50">📱</div>
                    <p className="text-gray-400 text-sm">No phones available</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Open camera page on your phone
                    </p>
                  </div>
                ) : (
                  availablePhones.map((phoneId) => (
                    <div
                      key={phoneId}
                      className="bg-gray-700/50 border border-gray-600 rounded-xl p-3 transition-all duration-200 hover:bg-gray-700/70"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-gray-300 truncate">
                          {phoneId}
                        </span>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            connectedPhone === phoneId
                              ? "bg-green-400"
                              : "bg-gray-500"
                          }`}
                        ></div>
                      </div>
                      <button
                        onClick={() => connectToPhone(phoneId)}
                        disabled={isConnecting || connectedPhone === phoneId}
                        className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                          connectedPhone === phoneId
                            ? "bg-green-600/20 border border-green-500/30 text-green-400 cursor-not-allowed"
                            : isConnecting
                            ? "bg-gray-600/20 border border-gray-500/30 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400/50"
                        }`}
                      >
                        {connectedPhone === phoneId
                          ? "✅ Connected"
                          : isConnecting
                          ? "⏳ Connecting..."
                          : "🔗 Connect"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {connectedPhone && (
                <button
                  onClick={disconnect}
                  className="w-full mt-4 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 hover:border-red-400/50 font-medium py-2 px-4 rounded-lg transition-all duration-200"
                >
                  🔌 Disconnect
                </button>
              )}
            </div>

            {/* Quick Instructions */}
            <div className="mt-6 bg-blue-900/20 border border-blue-700/30 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                ⚡ <span>Quick Start</span>
              </h4>
              <div className="space-y-2 text-xs text-blue-200/80">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">1.</span>
                  <span>
                    Open <strong>/phone</strong> on mobile
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">2.</span>
                  <span>Allow camera permissions</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">3.</span>
                  <span>Click Connect above</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
