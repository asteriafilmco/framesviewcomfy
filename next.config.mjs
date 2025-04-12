/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ hostname: "*" }] },
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/comfy/output/:path*',
        destination: '/api/comfy/static/:path*',
      },
    ];
  },
};

export default nextConfig;
