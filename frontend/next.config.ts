import type { NextConfig } from "next";

// The UI calls the API at same-origin `/api/*`; this rewrite proxies it to the
// backend app (Render). Same-origin matters: the httpOnly `afe_session` cookie
// stays first-party on the frontend's domain, so login works in every browser
// (cross-site cookies to *.onrender.com would be blocked). Large uploads and
// uploaded media bypass the proxy and go straight to the backend (lib/api/uploads.ts).
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // The frontend lives inside the legacy repo, whose root eslint flat config
  // (eslint-plugin-prettier) is picked up by ESLint's upward search and fails
  // `next build` on formatting-only rules. Type-checking is still enforced.
  eslint: { ignoreDuringBuilds: true },
  // backend/verify harnesses build the frontend into its own folder so they can
  // run while `npm run dev` (which owns .next/) is running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
