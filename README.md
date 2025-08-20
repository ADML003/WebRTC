# WebRTC Phone-to-Browser Video Streaming App

A Next.js application that enables real-time video streaming from mobile phone cameras to web browsers using WebRTC technology.

## � About the App

This application allows you to:

- Stream live video from your phone's camera to a web browser
- Connect multiple phones to different browser sessions
- View real-time video feeds with responsive design
- Generate QR codes for easy device connection

## 🔗 API Endpoints

### Health Check

- `GET /api/health` - Server health status and environment info

### Signaling Server

- `POST /api/signaling` - WebRTC signaling for connection establishment
- `GET /api/signaling` - Retrieve active sessions and devices

### Metrics

- `GET /api/metrics` - Application performance metrics

### Key-Value Storage

- `POST /api/signaling-kv` - Persistent signaling using Vercel KV

## 🎯 Utility

- **Remote Monitoring**: View live camera feeds from mobile devices
- **Multi-Device Support**: Connect multiple phones simultaneously
- **Cross-Platform**: Works on iOS Safari and Android Chrome
- **Real-Time Communication**: Low-latency video streaming via WebRTC
- **QR Code Integration**: Easy device pairing through QR codes

## 🚀 Vercel Deployment

This app is optimized for Vercel deployment with:

- **Serverless Functions**: API routes as serverless functions
- **Edge Runtime**: Optimized for global performance
- **Vercel KV**: Persistent storage for signaling data
- **CORS Configuration**: Proper headers for cross-origin requests
- **Environment Variables**: Automatic deployment region detection

## �️ Next.js Features

Built with modern Next.js capabilities:

- **App Router**: Using the new app directory structure
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first styling
- **React 19**: Latest React features and optimizations
- **API Routes**: Server-side API endpoints
- **Static Generation**: Optimized build process

## 🔮 Future Scope of Improvements

### Core Features

- **AI Object Detection**: Real-time object recognition in video streams
- **Multi-User Rooms**: Group video sessions with multiple participants
- **Screen Recording**: Save and export video streams
- **Audio Support**: Two-way audio communication
- **Chat Integration**: Text messaging during video sessions

### Technical Enhancements

- **WebSocket Upgrade**: Real-time bidirectional communication
- **Progressive Web App**: Offline capabilities and app-like experience
- **Performance Optimization**: Frame rate adjustment and bandwidth optimization
- **Security Features**: End-to-end encryption and authentication
- **Analytics Dashboard**: Usage statistics and connection metrics
- **Mobile App**: Native iOS and Android applications

### Infrastructure

- **Redis Integration**: Scalable session management
- **Docker Support**: Container deployment options
- **CDN Integration**: Global content delivery
- **Load Balancing**: Multi-region deployment support
