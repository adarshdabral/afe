// /api/health — liveness probe (also confirms the database connection).
import { NextResponse } from "next/server";
import { ensureServerReady } from "@/server/bootstrap";

export async function GET() {
  try {
    await ensureServerReady();
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: { message: "Database unavailable." } }, { status: 503 });
  }
}
