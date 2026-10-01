import type { NextConfig } from "next";

// ai-spark backend: an API-only Next.js app (app/api/** Route Handlers + server/**).
// Deployed on Render; the frontend (Vercel) proxies /api/* here.
const nextConfig: NextConfig = {
  // Mongoose is loaded from node_modules at runtime (one shared connection +
  // model registry) instead of being bundled.
  serverExternalPackages: ["mongoose"],
  // No pages: skip the "x-powered-by" header and lint during build.
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
