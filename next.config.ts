import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Production caching: cache API routes for 1 hour */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=59" },
        ],
      },
    ];
  },

  /* Compress responses for faster transfers */
  compress: true,
};

export default nextConfig;
