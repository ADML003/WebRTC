/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@tensorflow/tfjs-node', 'sharp'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle TensorFlow.js and other native modules
      config.externals = config.externals || [];
      config.externals.push({
        '@tensorflow/tfjs-node': '@tensorflow/tfjs-node',
        'sharp': 'sharp',
        'canvas': 'canvas',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
