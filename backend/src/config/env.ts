// Centralized env access. Node binds env at process start, so reading at module
// scope is safe here (unlike the Cloudflare Workers per-request binding).

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error("JWT_SECRET must be set to a string of at least 32 characters in production.");
  }
  // Dev-only fallback (>= 32 chars). Set JWT_SECRET in .env for real use.
  return "afe-dev-insecure-jwt-secret__change_me_now";
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/ai-spark",
  jwtSecret: resolveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
};

/**
 * Whether new student self-registrations require teacher approval before they
 * can access course content. Default OFF — students are approved immediately.
 * Set `REQUIRE_TEACHER_APPROVAL=true` in the environment to enable the approval
 * workflow. Read dynamically (not cached) so it can be toggled per environment.
 */
export function requireTeacherApproval(): boolean {
  return String(process.env.REQUIRE_TEACHER_APPROVAL ?? "false").toLowerCase() === "true";
}
