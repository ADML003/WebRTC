class PhoneCamera {
  constructor() {
    this.socket = null;
    this.localStream = null;
    this.peerConnection = null;
    this.phoneId = null;
    this.isStreaming = false;

    this.video = document.getElementById("video");
    this.startBtn = document.getElementById("startBtn");
    this.connectBtn = document.getElementById("connectBtn");
    this.stopBtn = document.getElementById("stopBtn");
    this.status = document.getElementById("status");
    this.connectionId = document.getElementById("connectionId");

    this.setupEventListeners();
    this.connectToServer();
  }

  setupEventListeners() {
    this.startBtn.onclick = () => this.startCamera();
    this.connectBtn.onclick = () => this.waitForConnection();
    this.stopBtn.onclick = () => this.stopStream();
  }

  connectToServer() {
    this.socket = io();

    this.socket.on("connect", () => {
      console.log("📱 Connected to server");
      this.socket.emit("phone-connect", {});
    });

    this.socket.on("phone-connected", (data) => {
      this.phoneId = data.phoneId;
      this.connectionId.textContent = `Phone ID: ${this.phoneId.substring(
        0,
        8
      )}...`;
      this.status.textContent = "Connected to server";
      console.log("📱 Phone registered:", this.phoneId);
    });

    this.socket.on("webrtc-offer", async (data) => {
      console.log("📡 Received WebRTC offer from browser");
      await this.handleOffer(data);
    });

    this.socket.on("webrtc-ice-candidate", (data) => {
      this.handleIceCandidate(data);
    });

    this.socket.on("disconnect", () => {
      this.status.textContent = "Disconnected from server";
      console.log("❌ Disconnected from server");
    });
  }

  async startCamera() {
    try {
      this.status.textContent = "Starting camera...";

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      this.video.srcObject = this.localStream;
      await this.video.play();

      this.startBtn.style.display = "none";
      this.connectBtn.style.display = "block";
      this.status.textContent = "Camera ready - waiting for browser connection";

      console.log("📹 Camera started");
    } catch (error) {
      console.error("❌ Camera access failed:", error);
      this.status.textContent = "Camera access failed";
      alert(
        "Camera access failed. Please ensure you have given permission and try again."
      );
    }
  }

  waitForConnection() {
    this.status.textContent = "Waiting for browser connection...";
    this.connectBtn.textContent = "Waiting for Browser...";
    this.connectBtn.disabled = true;

    console.log("📱 Ready for WebRTC connection. Phone ID:", this.phoneId);

    // Show instructions to user
    const instruction = document.createElement("div");
    instruction.id = "connection-instruction";
    instruction.style.cssText = `
      background: #e3f2fd;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
      font-size: 14px;
    `;
    instruction.innerHTML = `
      <strong>📋 Next Steps:</strong><br>
      1. Open the browser viewer on your computer<br>
      2. Click "Connect to Phone"<br>
      3. Select your phone ID: <code>${this.phoneId.substring(
        0,
        8
      )}...</code><br>
      4. Wait for connection to establish
    `;

    // Insert after status
    const statusElement = document.getElementById("status");
    if (!document.getElementById("connection-instruction")) {
      statusElement.parentNode.insertBefore(
        instruction,
        statusElement.nextSibling
      );
    }
  }

  async handleOffer(data) {
    try {
      this.status.textContent = "Connecting to browser...";

      // Remove connection instruction if present
      const instruction = document.getElementById("connection-instruction");
      if (instruction) {
        instruction.remove();
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("📡 Sending ICE candidate:", event.candidate.type);
          this.socket.emit("webrtc-ice-candidate", {
            targetId: data.fromId,
            candidate: event.candidate,
          });
        } else {
          console.log("📡 ICE gathering completed");
        }
      };

      // Handle ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection.iceConnectionState;
        console.log("🧊 ICE connection state:", iceState);

        if (iceState === "connected" || iceState === "completed") {
          this.status.textContent = "WebRTC connected!";
        } else if (iceState === "disconnected") {
          this.status.textContent = "Connection lost";
        } else if (iceState === "failed") {
          this.status.textContent = "Connection failed - retrying...";
          this.resetConnection();
        }
      };

      // Handle connection state
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        console.log("📡 Connection state:", state);

        if (state === "connected") {
          this.status.textContent = "Streaming to browser!";
          this.isStreaming = true;
          this.connectBtn.style.display = "none";
          this.stopBtn.style.display = "block";
          this.stopBtn.className = "btn streaming";
        } else if (state === "connecting") {
          this.status.textContent = "Establishing connection...";
        } else if (state === "disconnected" || state === "failed") {
          this.status.textContent = "Connection lost";
          this.isStreaming = false;
          this.resetButtons();
        }
      };

      // Set remote description and create answer
      await this.peerConnection.setRemoteDescription(data.offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer back
      this.socket.emit("webrtc-answer", {
        targetId: data.fromId,
        answer: answer,
        sessionId: data.sessionId,
      });

      console.log("📡 WebRTC answer sent");

      // Set a timeout for connection establishment
      this.connectionTimeout = setTimeout(() => {
        if (
          this.peerConnection &&
          this.peerConnection.connectionState !== "connected"
        ) {
          console.log("⏰ Connection timeout - retrying...");
          this.status.textContent = "Connection timeout - click to retry";
          this.resetConnection();
        }
      }, 15000); // 15 second timeout
    } catch (error) {
      console.error("❌ WebRTC setup failed:", error);
      this.status.textContent = "Connection failed - click to retry";
      this.resetConnection();
    }
  }

  resetConnection() {
    // Clear timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Close existing connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset button to allow retry
    this.connectBtn.style.display = "block";
    this.connectBtn.textContent = "Retry Connection";
    this.connectBtn.disabled = false;
  }

  handleIceCandidate(data) {
    if (this.peerConnection) {
      this.peerConnection
        .addIceCandidate(data.candidate)
        .then(() => console.log("📡 ICE candidate added"))
        .catch((err) => console.error("❌ ICE candidate error:", err));
    }
  }

  stopStream() {
    this.isStreaming = false;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.video.srcObject = null;
    this.status.textContent = "Stream stopped";
    this.resetButtons();

    console.log("⏹️ Stream stopped");
  }

  resetButtons() {
    this.startBtn.style.display = "block";
    this.connectBtn.style.display = "none";
    this.connectBtn.textContent = "Connect to Browser";
    this.connectBtn.disabled = false;
    this.stopBtn.style.display = "none";
    this.stopBtn.className = "btn";

    // Remove connection instruction if present
    const instruction = document.getElementById("connection-instruction");
    if (instruction) {
      instruction.remove();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PhoneCamera();
});
