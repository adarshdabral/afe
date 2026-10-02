import type { NextConfig } from "next";

// ai-spark backend: an API-only Next.js app (app/api/** Route Handlers + server/**).
// Deployed on Render; the frontend (Vercel) proxies /api/* here.
const nextConfig: NextConfig = {
  // Mongoose is loaded from node_modules at runtime (one shared connection +
  // model registry) instead of being bundled.
  serverExternalPackages: ["mongoose"],
  // verify/ harnesses build into their own folder so they can run while
  // `npm run dev` (which owns .next/) is running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No pages: skip the "x-powered-by" header and lint during build.
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
