# WebRTC Real-Time Object Detection System

A production-ready WebRTC system that streams live video from mobile phones to browsers for real-time AI object detection with overlay visualization.

## 🚀 Current Status

✅ **WORKING** - Full WebRTC streaming pipeline from phone to browser  
✅ **WORKING** - Real-time object detection with TensorFlow.js  
✅ **WORKING** - Live bounding box overlays on video stream  
✅ **WORKING** - Performance metrics collection and export  
✅ **WORKING** - Mock detection mode for testing  
✅ **WORKING** - Docker containerization ready

## � Quick Start

**One Command Start:**

```bash
chmod +x start.sh
./start.sh
```

**Manual Start:**

```bash
npm install
node server/simple-index.js
```

**Docker Start:**

```bash
docker-compose up
```

## 📱 Usage

1. Start the server using one of the commands above
2. Open the displayed URL on your phone's browser
3. Allow camera permissions
4. Click "Start Camera"
5. Point camera at objects to see real-time detection

## 🏗️ Architecture

### Low-Resource Mode (Default)

- **Client**: Phone browser captures video at 320x240
- **Server**: ONNX Runtime with YOLOv8n (6MB model)
- **Processing**: CPU-only inference, 10-15 FPS
- **Latency**: ~100-200ms end-to-end

### Server Mode

- Same architecture but with GPU acceleration if available
- Higher resolution processing (640x640)
- Lower latency (~50-100ms)

## 📊 Metrics

Real-time metrics available at:

- **Live**: Bottom-right corner of browser
- **Detailed**: `http://localhost:3000/metrics`
- **Export**: `metrics.json` (auto-generated)

## 🛠️ Technical Details

### Performance Optimizations

- Adaptive frame rate (10-15 FPS)
- Image downsampling (320x240 → 640x640)
- Efficient WebSocket communication
- Normalized coordinates for overlay alignment
- Frame synchronization with timestamps

### Dependencies

- **Server**: Node.js, Express, WebSocket, ONNX Runtime
- **Client**: Vanilla JavaScript, Canvas API
- **Model**: YOLOv8n (optimized for speed)

## 📋 Requirements

- Node.js 16+
- Modern browser with camera access
- 2GB RAM minimum
- No GPU required (CPU inference)

## 🔧 Development

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Health check
curl http://localhost:3000/health
```

## 📈 Performance Targets

- **Latency**: <200ms end-to-end
- **FPS**: 10-15 processing rate
- **Memory**: <500MB server usage
- **CPU**: <50% on modest laptops

## 🌐 Browser Support

- **Mobile**: Chrome (Android), Safari (iOS)
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Requirements**: WebRTC, WebSocket, Canvas API
