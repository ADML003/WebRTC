class BrowserViewer {
  constructor() {
    this.socket = null;
    this.peerConnection = null;
    this.connectedPhone = null;
    this.availablePhones = [];
    this.ontrackCalled = false; // Debug flag
    this.connectionTimeout = null;
    
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.phoneList = document.getElementById('phoneList');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.status = document.getElementById('status');
    this.connectionInfo = document.getElementById('connectionInfo');
    this.metricsElements = {
      fps: document.getElementById('fps'),
      latency: document.getElementById('latency'),
      objects: document.getElementById('objects'),
      frames: document.getElementById('frames')
    };
    
    this.setupEventListeners();
    this.connectToServer();
  }
  
  setupEventListeners() {
    this.refreshBtn.onclick = () => this.refreshPhones();
    this.disconnectBtn.onclick = () => this.disconnect();
  }
  
  connectToServer() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('🖥️ Connected to server');
      this.socket.emit('browser-connect', {});
      this.updateStatus('Connected to server');
    });
    
    this.socket.on('browser-connected', (data) => {
      console.log('🖥️ Browser registered:', data.browserId);
    });
    
    this.socket.on('available-phones', (data) => {
      this.availablePhones = data.phones;
      this.updatePhoneList();
      console.log('📱 Available phones:', data.phones);
    });
    
    this.socket.on('webrtc-answer', async (data) => {
      console.log('📡 Received WebRTC answer');
      try {
        // Check if peer connection is in correct state
        if (this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(data.answer);
          console.log('✅ Remote description set successfully');
        } else {
          console.log('⚠️ Ignoring answer - peer connection not in correct state:', this.peerConnection?.signalingState);
        }
      } catch (error) {
        console.error('❌ Error setting remote description:', error);
      }
    });
    
    this.socket.on('webrtc-ice-candidate', (data) => {
      if (this.peerConnection) {
        console.log('📡 Browser received ICE candidate:', data.candidate.type);
        this.peerConnection.addIceCandidate(data.candidate)
          .then(() => console.log('✅ ICE candidate added successfully'))
          .catch(err => console.error('❌ Error adding ICE candidate:', err));
      }
    });
    
    this.socket.on('webrtc-error', (data) => {
      console.error('❌ WebRTC error:', data.error);
      this.updateStatus(`Error: ${data.error}`);
    });
    
    this.socket.on('detection-result', (result) => {
      this.drawDetections(result.detections);
      this.updateMetrics(result);
    });
    
    this.socket.on('disconnect', () => {
      this.updateStatus('Disconnected from server');
    });
  }
  
  refreshPhones() {
    if (this.socket) {
      this.socket.emit('browser-connect', {});
    }
  }
  
  updatePhoneList() {
    if (this.availablePhones.length === 0) {
      this.phoneList.innerHTML = '<div class="phone-item">No phones available</div>';
      this.phoneList.classList.add('hidden');
    } else {
      this.phoneList.innerHTML = '';
      this.availablePhones.forEach(phoneId => {
        const phoneItem = document.createElement('div');
        phoneItem.className = 'phone-item';
        phoneItem.textContent = `📱 ${phoneId.substring(0, 8)}...`;
        phoneItem.onclick = () => {
          // Prevent multiple clicks while connecting
          if (phoneItem.disabled) return;
          phoneItem.disabled = true;
          phoneItem.style.opacity = '0.5';
          this.connectToPhone(phoneId).finally(() => {
            phoneItem.disabled = false;
            phoneItem.style.opacity = '1';
          });
        };
        this.phoneList.appendChild(phoneItem);
      });
      this.phoneList.classList.remove('hidden');
    }
  }
  
  async connectToPhone(phoneId) {
    if (!this.socket) return;
    
    // Prevent multiple simultaneous connections
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      console.log('🚫 Connection already in progress, disconnecting first');
      this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    }
    
    try {
      this.updateStatus('Connecting to phone...');
      
      // Create peer connection with TURN servers for NAT traversal
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          // Free STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          // Multiple TURN servers for better reliability
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
          // Additional free TURN servers
          {
            urls: 'turn:relay.metered.ca:80',
            username: 'e8348e4d9c62d3e36c996bcf',
            credential: 'P6s8Q1gKNp7r2hXp',
          },
          {
            urls: 'turn:relay.metered.ca:443',
            username: 'e8348e4d9c62d3e36c996bcf',
            credential: 'P6s8Q1gKNp7r2hXp',
          },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all', // Allow both STUN and TURN
      });
      
      // Handle incoming stream
      this.peerConnection.ontrack = (event) => {
        this.ontrackCalled = true;
        console.log('🎉 ONTRACK EVENT TRIGGERED!', event);
        console.log('📹 Event streams:', event.streams);
        console.log('📹 Event track:', event.track);
        
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          console.log('📹 Stream ID:', stream.id);
          console.log('📹 Stream active:', stream.active);
          console.log('📹 All tracks:', stream.getTracks());
          console.log('📹 Video tracks:', stream.getVideoTracks());
          console.log('📹 Audio tracks:', stream.getAudioTracks());
          
          // Check video tracks specifically
          const videoTracks = stream.getVideoTracks();
          videoTracks.forEach((track, index) => {
            console.log(`📹 Video track ${index}:`, {
              id: track.id,
              kind: track.kind,
              enabled: track.enabled,
              readyState: track.readyState,
              muted: track.muted
            });
          });
          
          console.log('📹 Setting video.srcObject to stream');
          this.video.srcObject = stream;
          
          // Add event listeners to video element
          this.video.onloadedmetadata = () => {
            console.log('📹 Video metadata loaded');
            console.log('📹 Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
          };
          
          this.video.oncanplay = () => {
            console.log('📹 Video can play');
          };
          
          this.video.onplay = () => {
            console.log('📹 Video started playing');
          };
          
          this.video.onerror = (e) => {
            console.error('❌ Video error:', e, this.video.error);
          };
          
          this.video.play().then(() => {
            console.log('✅ Video play() succeeded');
          }).catch(e => {
            console.error('❌ Error playing video:', e);
          });
        } else {
          console.error('❌ No streams in track event!');
        }
        
        this.updateStatus('Connected - receiving video');
        this.connectedPhone = phoneId;
        this.phoneList.classList.add('hidden');
        this.disconnectBtn.classList.remove('hidden');
        this.connectionInfo.textContent = `Connected to: ${phoneId.substring(0, 8)}...`;
      };
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('📡 Browser sending ICE candidate:', event.candidate.type, event.candidate.candidate);
          this.socket.emit('webrtc-ice-candidate', {
            targetId: phoneId,
            candidate: event.candidate,
          });
        } else {
          console.log('📡 Browser ICE gathering completed');
        }
      };
      
      // Handle ICE gathering state
      this.peerConnection.onicegatheringstatechange = () => {
        console.log('🧊 Browser ICE gathering state:', this.peerConnection.iceGatheringState);
      };
      
      // Handle ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection.iceConnectionState;
        console.log('🧊 Browser ICE connection state:', iceState);
        
        if (iceState === 'connected' || iceState === 'completed') {
          this.updateStatus('WebRTC connected!');
          clearTimeout(this.connectionTimeout);
        } else if (iceState === 'failed') {
          console.log('❌ ICE connection failed - connection cannot be established');
          this.updateStatus('Connection failed - NAT/Firewall issue');
          clearTimeout(this.connectionTimeout);
          setTimeout(() => this.disconnect(), 2000);
        } else if (iceState === 'disconnected') {
          this.updateStatus('Connection lost');
        } else if (iceState === 'checking') {
          this.updateStatus('Checking connectivity...');
        }
      };
      
      // Handle connection state
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        console.log('📡 Browser connection state:', state);
        
        if (state === 'connected') {
          this.updateStatus('Streaming from phone!');
        } else if (state === 'connecting') {
          this.updateStatus('Establishing connection...');
        } else if (state === 'disconnected' || state === 'failed') {
          this.updateStatus('Connection lost');
          this.disconnect();
        }
      };
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      const sessionId = `session_${Date.now()}`;
      this.socket.emit('webrtc-offer', {
        targetId: phoneId,
        offer: offer,
        sessionId: sessionId,
      });
      
      console.log('📡 WebRTC offer sent to phone:', phoneId);
      
      // Set a timeout for connection establishment
      this.connectionTimeout = setTimeout(() => {
        if (this.peerConnection && this.peerConnection.iceConnectionState !== 'connected' && this.peerConnection.iceConnectionState !== 'completed') {
          console.log('⏰ Connection timeout - WebRTC failed to establish');
          console.log('🔍 Debug: ontrack called?', this.ontrackCalled);
          this.updateStatus('Connection timeout - Try again');
          this.disconnect();
        }
      }, 30000); // 30 second timeout
      
      // Additional debug timeout specifically for ontrack
      setTimeout(() => {
        if (!this.ontrackCalled) {
          console.log('⚠️ WARNING: ontrack event has NOT been triggered after 10 seconds!');
          console.log('🔍 This suggests the phone is not sending video tracks properly');
        }
      }, 10000); // 10 second debug timeout
      
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.updateStatus('Connection failed: ' + error.message);
    }
  }
  
  disconnect() {
    // Clear any existing timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.video.srcObject = null;
    this.connectedPhone = null;
    this.updateStatus('Disconnected');
    this.connectionInfo.textContent = 'No connection';
    this.phoneList.classList.remove('hidden');
    this.disconnectBtn.classList.add('hidden');
    
    // Clear canvas
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  drawDetections(detections) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.video.videoWidth) return;
    
    // Set canvas size to match video
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw detections
    detections.forEach(detection => {
      const x = detection.xmin * this.canvas.width;
      const y = detection.ymin * this.canvas.height;
      const width = (detection.xmax - detection.xmin) * this.canvas.width;
      const height = (detection.ymax - detection.ymin) * this.canvas.height;
      
      // Draw bounding box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw label background
      ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
      const label = `${detection.label} ${Math.round(detection.score * 100)}%`;
      ctx.font = '16px Arial';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 25, textWidth + 10, 25);
      
      // Draw label text
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 5, y - 8);
    });
    
    // Update objects count
    this.metricsElements.objects.textContent = detections.length;
  }
  
  updateMetrics(result) {
    if (result.inference_ts && result.capture_ts) {
      this.metricsElements.latency.textContent = result.inference_ts - result.capture_ts;
    }
    
    const currentFrames = parseInt(this.metricsElements.frames.textContent) + 1;
    this.metricsElements.frames.textContent = currentFrames;
    
    // Calculate FPS (rough estimate)
    if (!this.lastFrameTime) {
      this.lastFrameTime = Date.now();
      this.frameCount = 0;
    }
    
    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFrameTime >= 1000) {
      this.metricsElements.fps.textContent = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }
  
  updateStatus(message) {
    const statusDiv = this.status.querySelector('div');
    if (statusDiv) {
      statusDiv.innerHTML = `<strong>Status:</strong> ${message}`;
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BrowserViewer();
});
