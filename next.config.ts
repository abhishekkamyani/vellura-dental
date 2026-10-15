import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Object form (no `search` key) so Unsplash's sizing query strings are allowed.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
