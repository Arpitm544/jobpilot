/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/api/v1/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000'}/api/v1/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
