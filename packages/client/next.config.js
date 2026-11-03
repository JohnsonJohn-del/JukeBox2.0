/** @type {import('next').NextConfig} */
const CLOUDFLARE_TUNNEL_URL = 'https://tales-vpn-stronger-pst.trycloudflare.com';

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${CLOUDFLARE_TUNNEL_URL}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${CLOUDFLARE_TUNNEL_URL}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
