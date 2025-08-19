/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for better compatibility
  images: {
    unoptimized: true,
  },
  // Remove standalone - use custom server instead
};

module.exports = nextConfig;