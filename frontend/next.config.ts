import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The frontend lives inside the legacy TanStack repo, whose root eslint flat
  // config (eslint-plugin-prettier) is picked up by ESLint's upward search and
  // fails `next build` on formatting-only rules. Linting is handled separately;
  // don't gate the production build on the inherited config. Type-checking is
  // still enforced by `tsc`/`next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
