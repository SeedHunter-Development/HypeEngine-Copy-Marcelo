import type { NextConfig } from "next";

const API_URL = `http://localhost:${process.env.API_PORT ?? "8080"}`;

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  allowedDevOrigins: ["*.replit.dev", "*.kirk.replit.dev", "*.pike.replit.dev", "*.repl.co"],
  transpilePackages: ["@workspace/db"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
