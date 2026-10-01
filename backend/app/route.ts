// GET / — this is the API-only backend; point humans at the health check.
export function GET() {
  return Response.json({ data: { service: "ai-spark-backend", health: "/api/health" } });
}
