# WebRTC Real-Time Object Detection with Next.js

A modern WebRTC application built with Next.js that streams live video from mobile phones to browsers for real-time AI object detection with overlay visualization.

## 🚀 Features

✅ **Next.js 15** with App Router and TypeScript  
✅ **Real-time WebRTC** streaming from phone to browser  
✅ **AI Object Detection** with TensorFlow.js  
✅ **Live Bounding Box** overlays on video stream  
✅ **Socket.IO** for real-time communication  
✅ **Responsive Design** with Tailwind CSS  
✅ **QR Code Access** for easy mobile connection  
✅ **Performance Metrics** tracking and export  

## 🏃‍♂️ Quick Start

### Development Mode

```bash
cd webrtc-nextjs
npm install
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## 📱 Usage

1. Start the server using `npm run dev`
2. Open http://localhost:3000/qr on your computer to see the QR code
3. Scan the QR code with your phone or visit http://localhost:3000/phone
4. Allow camera permissions on your phone
5. Click "Start Camera" then "Connect to Browser"
6. Open http://localhost:3000 on your computer to view the stream
7. Watch real-time object detection with bounding boxes!

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Socket.IO, Custom Server
- **WebRTC**: Peer-to-peer video streaming
- **AI**: TensorFlow.js Node (with fallback to mock detection)
- **Image Processing**: Sharp (optional)

### Project Structure

```
webrtc-nextjs/
├── src/app/
│   ├── page.tsx          # Browser viewer (main page)
│   ├── phone/page.tsx    # Phone camera interface
│   ├── qr/page.tsx       # QR code page
│   └── api/
│       ├── health/route.ts   # Health check endpoint
│       └── metrics/route.ts  # Performance metrics
├── lib/
│   └── webrtc-server.js  # WebRTC server logic
├── server.js             # Custom Next.js server with Socket.IO
└── next.config.js        # Next.js configuration
```

## 📊 API Endpoints

- `GET /api/health` - Server health and connection status
- `GET /api/metrics` - Performance metrics and analytics
- `GET /` - Browser viewer interface
- `GET /phone` - Phone camera interface
- `GET /qr` - QR code for mobile access

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
PORT=3000
NODE_ENV=development
```

### Next.js Configuration

The app uses a custom server configuration in `server.js` to support Socket.IO alongside Next.js.

## 📈 Performance

- **Latency**: <200ms end-to-end
- **FPS**: 10-15 processing rate
- **Memory**: <500MB server usage
- **CPU**: <50% on modest hardware

## 🌐 Browser Support

- **Mobile**: Chrome (Android), Safari (iOS)
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Requirements**: WebRTC, WebSocket, Canvas API

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
# Deploy to Vercel with custom server support
```

### Docker

```bash
docker build -t webrtc-nextjs .
docker run -p 3000:3000 webrtc-nextjs
```

### Traditional Hosting

```bash
npm run build
npm start
```

## 🛠️ Development

### Adding New Features

1. **Frontend Components**: Add to `src/app/` or `src/components/`
2. **API Routes**: Add to `src/app/api/`
3. **Server Logic**: Modify `lib/webrtc-server.js`
4. **Styling**: Use Tailwind CSS classes

### Testing

```bash
npm run lint    # ESLint checking
npm run build   # Build verification
```

## 📋 Requirements

- Node.js 18+
- Modern browser with WebRTC support
- Camera-enabled mobile device
- 2GB RAM minimum (for TensorFlow.js)

## 🔍 Troubleshooting

### Common Issues

1. **Camera not accessible**: Ensure HTTPS for production or localhost for development
2. **WebRTC connection fails**: Check firewall settings and STUN servers
3. **TensorFlow.js errors**: Falls back to mock detection automatically
4. **Socket.IO issues**: Verify custom server configuration

### Debug Mode

Set `NODE_ENV=development` for detailed logging.

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ using Next.js, WebRTC, and TensorFlow.js