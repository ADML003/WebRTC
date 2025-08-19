/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for better compatibility
  images: {
    unoptimized: true,
  },
  // Use standalone for Railway deployment
  output: 'standalone',
};

module.exports = nextConfig;