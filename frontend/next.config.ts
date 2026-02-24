import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the multi-stage Docker build (produces .next/standalone)
  output: "standalone",
};

export default nextConfig;
