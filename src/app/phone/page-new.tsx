"use client";

import { useEffect, useRef, useState } from "react";

export default function PhoneCamera() {
  const [phoneId, setPhoneId] = useState<string>("");
  const [status, setStatus] = useState("Ready to start camera");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Offline");
  const [connectedBrowser, setConnectedBrowser] = useState<string | null>(null);
  const [videoConstraints, setVideoConstraints] = useState({
    facingMode: "environment",
    quality: "HD",
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
    const id = "phone_" + Math.random().toString(36).substr(2, 9);
    setPhoneId(id);
  }, []);

  // Register phone when ID is available
  useEffect(() => {
    if (!phoneId || !isClient) return;

    const registerPhone = async () => {
      try {
        await fetch("/api/signaling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "register",
            deviceId: phoneId,
            data: { deviceType: "phone" },
          }),
        });

        setConnectionStatus("Connected to server");
        console.log("📱 Phone registered:", phoneId);
      } catch (error) {
        console.error("Registration error:", error);
        setConnectionStatus("Connection failed");
      }
    };

    registerPhone();
  }, [phoneId, isClient]);

  const getVideoConstraints = () => {
    const baseConstraints = {
      facingMode: videoConstraints.facingMode,
      aspectRatio: { ideal: 16 / 9 },
      frameRate: { ideal: 30, min: 15, max: 30 },
    };

    if (videoConstraints.quality === "HD") {
      return {
        ...baseConstraints,
        width: { ideal: 1280, min: 640, max: 1920 },
        height: { ideal: 720, min: 480, max: 1080 },
      };
    } else if (videoConstraints.quality === "SD") {
      return {
        ...baseConstraints,
        width: { ideal: 854, min: 480, max: 1280 },
        height: { ideal: 480, min: 360, max: 720 },
      };
    } else {
      return {
        ...baseConstraints,
        width: { ideal: 640, min: 320, max: 854 },
        height: { ideal: 360, min: 240, max: 480 },
      };
    }
  };

  const startCamera = async () => {
    try {
      setStatus("Starting camera...");

      const constraints = {
        video: getVideoConstraints(),
        audio: false,
      };

      console.log("📹 Requesting camera with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log("📹 Camera settings:", settings);
      }

      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("📺 Video metadata loaded");
          videoRef.current?.play().catch((error) => {
            console.error("❌ Video play failed:", error);
          });
        };
      }

      setIsStreaming(true);
      setStatus("Camera active - Ready for connections");

      // Start polling for WebRTC offers
      startPollingForOffers();
    } catch (err) {
      console.error("❌ Camera error:", err);
      const error = err as Error;

      if (error.name === "NotAllowedError") {
        setStatus("❌ Camera access denied. Please allow camera permissions.");
      } else if (error.name === "NotFoundError") {
        setStatus("❌ No camera found on this device.");
      } else {
        setStatus(`❌ Camera error: ${error.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsStreaming(false);
    setStatus("Camera stopped");
    setConnectedBrowser(null);
  };

  const startPollingForOffers = () => {
    const pollOffers = async () => {
      try {
        const response = await fetch(
          `/api/signaling?type=offer&deviceId=${phoneId}&sessionId=${phoneId}_browser`
        );
        const data = await response.json();

        if (data.success && data.offer) {
          await handleOffer(data.offer);
        }
      } catch (error) {
        console.error("Error polling for offers:", error);
      }
    };

    pollOffers();
    pollingIntervalRef.current = setInterval(pollOffers, 1000);
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      console.log("📥 Received offer from browser");

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peerConnectionRef.current = pc;

      // Add local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch("/api/signaling", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "ice-candidate",
                deviceId: phoneId,
                targetId: "browser",
                data: {
                  sessionId: `${phoneId}_browser`,
                  candidate: event.candidate,
                },
              }),
            });
          } catch (error) {
            console.error("Error sending ICE candidate:", error);
          }
        }
      };

      // Set remote description and create answer
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      await fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "answer",
          deviceId: phoneId,
          targetId: "browser",
          data: {
            sessionId: `${phoneId}_browser`,
            answer: answer,
          },
        }),
      });

      setConnectedBrowser("browser");
      setStatus("🔴 Live streaming to browser");
      console.log("📤 Answer sent to browser");
    } catch (error) {
      console.error("Error handling offer:", error);
      setStatus("❌ Connection failed");
    }
  };

  const switchCamera = () => {
    setVideoConstraints((prev) => ({
      ...prev,
      facingMode: prev.facingMode === "environment" ? "user" : "environment",
    }));

    if (isStreaming) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  };

  const changeQuality = (quality: string) => {
    setVideoConstraints((prev) => ({
      ...prev,
      quality,
    }));

    if (isStreaming) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl font-light">
          Loading Camera Interface...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                📱 Phone Camera
              </h1>
              <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-2 rounded-full">
                <div
                  className={`w-3 h-3 rounded-full ${
                    connectionStatus === "Connected to server"
                      ? "bg-green-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                ></div>
                <span className="text-sm text-slate-300">
                  {connectionStatus}
                </span>
              </div>
            </div>
            <div className="text-sm text-slate-400 bg-slate-800/30 px-3 py-1 rounded-lg">
              ID:{" "}
              <span className="font-mono text-blue-400">
                {phoneId.slice(-6)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Status Card */}
        <div className="mb-6 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className={`w-4 h-4 rounded-full ${
                  isStreaming
                    ? connectedBrowser
                      ? "bg-red-500 animate-pulse"
                      : "bg-yellow-500 animate-pulse"
                    : "bg-gray-500"
                }`}
              ></div>
              <span className="text-lg font-semibold text-white">{status}</span>
            </div>
            {connectedBrowser && (
              <div className="bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-full">
                <span className="text-red-400 text-sm font-semibold uppercase tracking-wide">
                  🔴 LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Video Display */}
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <div className="text-center p-8">
                  <div className="text-8xl mb-6 opacity-30">📷</div>
                  <div className="text-2xl mb-4 text-slate-200 font-light">
                    Camera Inactive
                  </div>
                  <div className="text-lg text-slate-400 mb-6">
                    Start your camera to begin streaming
                  </div>
                </div>
              </div>
            )}

            {/* Camera Controls Overlay */}
            {isStreaming && (
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={switchCamera}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-200"
                  title="Switch Camera"
                >
                  🔄
                </button>
                <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-medium">
                    {videoConstraints.facingMode === "environment"
                      ? "📹 Rear"
                      : "🤳 Front"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Camera Controls */}
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              📷 Camera Controls
            </h3>

            <div className="space-y-4">
              {!isStreaming ? (
                <button
                  onClick={startCamera}
                  className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 text-green-400 py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3"
                >
                  ▶️ Start Camera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3"
                >
                  ⏹️ Stop Camera
                </button>
              )}

              <button
                onClick={switchCamera}
                disabled={!isStreaming}
                className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
                  isStreaming
                    ? "bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-400"
                    : "bg-slate-600/20 border border-slate-500/30 text-slate-500 cursor-not-allowed"
                }`}
              >
                🔄 Switch Camera
              </button>
            </div>
          </div>

          {/* Quality Settings */}
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              ⚙️ Quality Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Video Quality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["HD", "SD", "LOW"].map((quality) => (
                    <button
                      key={quality}
                      onClick={() => changeQuality(quality)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                        videoConstraints.quality === quality
                          ? "bg-blue-600/30 border border-blue-500/50 text-blue-400"
                          : "bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:bg-slate-700/50"
                      }`}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-700/20 rounded-lg p-4">
                <div className="text-sm text-slate-300 mb-2">
                  <strong>Current:</strong> {videoConstraints.quality} Quality
                </div>
                <div className="text-xs text-slate-400">
                  Camera:{" "}
                  {videoConstraints.facingMode === "environment"
                    ? "Rear"
                    : "Front"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-700/30 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
            📋 Instructions
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-white mb-3">
                Getting Started:
              </h5>
              <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>Click "Start Camera" to begin</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>Allow camera permissions when prompted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500/20 text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>Connect from the browser interface</span>
                </li>
              </ol>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-3">Tips:</h5>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">💡</span>
                  <span>Use rear camera for better object detection</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">💡</span>
                  <span>HD quality provides better accuracy</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">💡</span>
                  <span>Ensure good lighting for best results</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
