'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function QRCodePage() {
  const [phoneURL, setPhoneURL] = useState('');
  const [accessType, setAccessType] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client flag to prevent hydration mismatch
    setIsClient(true);
    
    // Get current host and protocol
    const host = window.location.host;
    const protocol = window.location.protocol;

    let url;
    let type;

    if (host && host.includes('.vercel.app')) {
      // Using Vercel deployment
      url = `${protocol}//${host}/phone`;
      type = '🌍 PUBLIC ACCESS (Vercel)';
    } else if (host && host.includes('.netlify.app')) {
      // Using Netlify deployment
      url = `${protocol}//${host}/phone`;
      type = '🌍 PUBLIC ACCESS (Netlify)';
    } else if (host && (host.includes('.ngrok.io') || host.includes('.localtunnel.me') || host.includes('.serveo.net'))) {
      // Using tunnel service
      url = `${protocol}//${host}/phone`;
      type = '🌍 PUBLIC ACCESS (Tunnel)';
    } else if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      // Using custom domain
      url = `${protocol}//${host}/phone`;
      type = '🌐 PUBLIC ACCESS';
    } else {
      // Local development - get network IP
      url = `${protocol}//${host}/phone`;
      type = '🏠 LOCAL NETWORK ACCESS';
    }

    setPhoneURL(url);
    setAccessType(type);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-5">
      <div className="bg-white/95 p-10 rounded-3xl shadow-2xl text-center text-gray-800 max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-2">📱 WebRTC Phone Camera</h1>
        <h2 className="text-lg text-blue-600 mb-4">{isClient ? accessType : 'Loading...'}</h2>
        <p className="mb-6">Scan this QR code with your phone to access the camera interface</p>
        
        {isClient && phoneURL ? (
          <div className="mb-6 p-5 bg-white rounded-xl inline-block shadow-md">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(phoneURL)}`}
              alt="QR Code for Phone Access"
              width={200}
              height={200}
              className="block"
            />
          </div>
        ) : (
          <div className="mb-6 p-5 bg-gray-100 rounded-xl shadow-md w-[200px] h-[200px] flex items-center justify-center mx-auto">
            <div className="text-gray-500">Loading QR Code...</div>
          </div>
        )}
        
        <div className="bg-gray-100 p-4 rounded-lg mb-6 break-all">
          <strong>Phone URL:</strong><br />
          <span className="font-mono text-sm">{isClient ? phoneURL : 'Loading...'}</span>
        </div>
        
        <div className="bg-blue-50 p-5 rounded-lg mb-6 text-left">
          <h2 className="font-bold mb-3">📋 Setup Instructions:</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <span className="text-lg mr-2">📱</span>
              <span><strong>Step 1:</strong> Scan QR code with your phone camera</span>
            </div>
            <div className="flex items-start">
              <span className="text-lg mr-2">📶</span>
              <span><strong>Step 2:</strong> Make sure phone & computer are connected</span>
            </div>
            <div className="flex items-start">
              <span className="text-lg mr-2">📷</span>
              <span><strong>Step 3:</strong> Allow camera permissions on phone</span>
            </div>
            <div className="flex items-start">
              <span className="text-lg mr-2">🔗</span>
              <span><strong>Step 4:</strong> Connect to browser for live detection</span>
            </div>
          </div>
        </div>
        
        <p className="text-sm mb-6"><strong>💡 Alternative:</strong> Manually type the URL above into your phone&apos;s browser</p>
        
        <Link 
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          🖥️ Open Browser Viewer
        </Link>
      </div>
    </div>
  );
}
