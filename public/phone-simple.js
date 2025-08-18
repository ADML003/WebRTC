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
      this.connectionId.textContent = `Phone ID: ${this.phoneId.substring(0, 8)}...`;
      this.status.textContent = "Ready - Click 'Start Camera'";
    });

    this.socket.on("webrtc-offer", (data) => {
      this.handleOffer(data);
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
      this.connectBtn.style.display = "inline-block";
      this.stopBtn.style.display = "inline-block";
      this.status.textContent = "Camera started - Ready to connect";

      this.isStreaming = true;
    } catch (error) {
      console.error("Error starting camera:", error);
      this.status.textContent = "Camera access denied or not available";
    }
  }

  waitForConnection() {
    if (!this.isStreaming) {
      this.status.textContent = "Please start camera first";
      return;
    }

    this.status.textContent = "Waiting for browser to connect...";
    this.connectBtn.disabled = true;
  }

  async handleOffer(data) {
    try {
      this.status.textContent = "Connecting to browser...";

      if (!this.localStream) {
        this.status.textContent = "ERROR: Start camera first!";
        return;
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
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
        ],
      });

      // Add local stream tracks
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit("webrtc-ice-candidate", {
            targetId: data.fromId,
            candidate: event.candidate,
          });
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
      });

      this.status.textContent = "Connected to browser!";
    } catch (error) {
      console.error("Error handling offer:", error);
      this.status.textContent = "Connection failed";
    }
  }

  stopStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.video.srcObject = null;
    this.startBtn.style.display = "inline-block";
    this.connectBtn.style.display = "none";
    this.stopBtn.style.display = "none";
    this.connectBtn.disabled = false;
    this.status.textContent = "Stopped";
    this.isStreaming = false;
  }
}

// Initialize when page loads
window.addEventListener("DOMContentLoaded", () => {
  new PhoneCamera();
});
