// Where the backend (Next.js API app on Render) lives. NEXT_PUBLIC_ so it is
// available to the browser (direct uploads/media), middleware and server code;
// it's inlined at BUILD time — redeploy the frontend after changing it.
export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
