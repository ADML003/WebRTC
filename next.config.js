/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image configuration for external domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        port: "",
        pathname: "/v1/create-qr-code/**",
      },
    ],
  },
  // Remove standalone - use custom server instead
};

module.exports = nextConfig;
