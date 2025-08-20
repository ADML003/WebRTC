# 🎥 WebRTC Real-Time Object Detection System (Next.js)

A beautiful, production-ready WebRTC system built with **Next.js 15** that streams live video from mobile phones to browsers for real-time AI object detection with overlay visualization.

## ✨ Features

- 🎨 **Beautiful Modern UI** - Stunning gradient backgrounds and glassmorphism effects
- 📱 **Mobile-First Design** - Optimized interfaces for both phone and browser
- 🚀 **Next.js 15** - Latest React framework with App Router
- 🎯 **Real-Time Object Detection** - AI-powered detection with live overlays
- 📊 **Live Statistics** - FPS, detection count, and connection status
- 🎛️ **Advanced Controls** - Quality settings, camera switching, fullscreen
- 🔄 **Seamless WebRTC** - Low-latency peer-to-peer streaming
- 🎨 **Tailwind CSS** - Modern styling with custom components

## 🚀 Quick Start

### One Command Start:

```bash
chmod +x start-nextjs.sh
./start-nextjs.sh
```

### Manual Start:

```bash
npm install
npm run dev
```

## 📱 Usage

1. **Start the application** using one of the commands above
2. **On your phone**: Open `http://localhost:3000/phone`
3. **On your computer**: Open `http://localhost:3000`
4. **Allow camera permissions** on your phone
5. **Click "Start Camera"** on phone
6. **Click "Connect"** for your phone in the browser interface
7. **Watch live object detection** with beautiful overlays!

## 🌐 Network Access

The app is available on your local network:

- **Local**: http://localhost:3000
- **Network**: http://[your-ip]:3000 (shown in terminal)

Use the network URL to access from other devices on the same WiFi network.

## 🎨 Interface Features

### 🖥️ Browser Interface (Main Dashboard)

- **Wide Video Display** - 4/5 screen width for optimal viewing
- **Live Statistics Dashboard** - Real-time metrics and connection status
- **Device Management Panel** - Easy phone connection and control
- **Advanced Settings** - Detection confidence, object limits, quality controls
- **Full-screen Support** - Immersive viewing experience
- **Beautiful Animations** - Smooth transitions and hover effects

### 📱 Phone Interface (Camera Control)

- **Mobile-Optimized Design** - Touch-friendly controls and layout
- **Camera Quality Options** - HD, SD, and Low quality settings
- **Front/Rear Camera Toggle** - Easy switching between cameras
- **Live Status Indicators** - Connection and streaming status
- **Responsive Design** - Works on all phone sizes

## 🛠️ Technical Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4 with custom animations
- **WebRTC**: Native browser APIs for peer-to-peer streaming
- **Real-time Communication**: HTTP-based signaling server
- **Deployment**: Vercel-ready with edge functions

## 📁 Project Structure

```
WebRTC/
├── src/app/
│   ├── page.tsx                 # Main browser interface
│   ├── phone/page.tsx           # Phone camera interface
│   ├── api/signaling/route.ts   # WebRTC signaling server
│   ├── globals.css              # Global styles
│   └── layout.tsx               # Root layout
├── package.json                 # Dependencies and scripts
├── start-nextjs.sh             # Quick start script
├── next.config.js              # Next.js configuration
└── README.md                   # This file
```

## 🔧 API Endpoints

- **GET /api/signaling?type=available-phones** - List connected phones
- **POST /api/signaling** - Handle WebRTC signaling (offers, answers, ICE)
- **GET /api/health** - Health check endpoint
- **GET /api/metrics** - Performance metrics

## 🎯 Object Detection

The system supports real-time object detection with:

- **Configurable confidence thresholds**
- **Maximum object limits**
- **Label display options**
- **Performance metrics tracking**

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel deploy
```

### Docker

```bash
docker build -t webrtc-nextjs .
docker run -p 3000:3000 webrtc-nextjs
```

## 🛡️ Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Mobile browsers

## 🔒 Security Notes

- Camera permissions required on phone
- HTTPS recommended for production
- STUN/TURN servers for NAT traversal
- No data stored permanently

## 📱 Mobile Optimization

- **Touch-friendly controls**
- **Responsive design**
- **Battery optimization**
- **Network efficiency**
- **Camera quality adaptation**

## 🎨 Customization

The interface uses a modern dark theme with:

- **Gradient backgrounds** - Slate to blue gradient
- **Glassmorphism effects** - Blurred transparent cards
- **Smooth animations** - Hover and transition effects
- **Custom scrollbars** - Styled for dark theme
- **Responsive grid layouts** - Adapts to all screen sizes

## 🐛 Troubleshooting

**Camera not working?**

- Check browser permissions
- Try different camera quality settings
- Ensure HTTPS in production

**Connection issues?**

- Check same network connectivity
- Verify firewall settings
- Try refreshing both devices

**Poor video quality?**

- Adjust quality settings on phone
- Check network bandwidth
- Try different camera (front/rear)

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using Next.js 15, React 19, and modern web technologies.**
