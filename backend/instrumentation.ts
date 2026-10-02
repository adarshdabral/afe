// Runs once when the Next.js server starts: connect to MongoDB, apply data
// migrations and the idempotent startup seeds (demo users, analytics cohort, forum).
// A failure is logged, not fatal — each API request retries via ensureServerReady().
//
// Next.js compiles this file for BOTH the Node.js and Edge runtimes. The server
// code (mongoose, node: built-ins) must stay inside this exact
// `process.env.NEXT_RUNTIME === "nodejs"` block so the Edge compile drops it —
// an early `return` is not enough (webpack still follows the import).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureServerReady } = await import("./server/bootstrap");
    try {
      await ensureServerReady();
    } catch (err) {
      console.error("[startup] database not ready:", err);
    }
  }
}
