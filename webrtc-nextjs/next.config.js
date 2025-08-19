/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for better Vercel compatibility
  images: {
    unoptimized: true,
  },
  // Enable static export for better deployment
  output: 'standalone',
};

module.exports = nextConfig;