// Runs once when the Next.js server starts: connect to MongoDB and apply the
// idempotent startup seeds (demo users, analytics cohort, forum).
// A failure is logged, not fatal — pages still render and each API request
// retries the connection via ensureServerReady().
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureServerReady } = await import("./server/bootstrap");
  try {
    await ensureServerReady();
  } catch (err) {
    console.error("[startup] database not ready:", err);
  }
}
