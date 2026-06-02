import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { seedDemoUsers } from "./seed/users.seed";
import authRoutes from "./routes/auth.routes";
import certificateRoutes from "./routes/certificate.routes";
import registrationRoutes from "./routes/registration.routes";
import analyticsRoutes from "./routes/analytics.routes";
import forumRoutes from "./routes/forum.routes";
import { seedAnalyticsCohort } from "./seed/analytics.seed";
import { seedForum } from "./seed/forum.seed";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ data: { ok: true } });
});

app.use("/api/auth", authRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/forum", forumRoutes);

// Central error handler — zod validation → 400, everything else → 500.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const anyErr = err as { name?: string; message?: string; issues?: unknown };
    if (anyErr?.name === "ZodError") {
      res.status(400).json({ error: { message: "Invalid request.", issues: anyErr.issues } });
      return;
    }
    res.status(500).json({ error: { message: anyErr?.message ?? "Internal server error." } });
  },
);

async function start(): Promise<void> {
  await connectDb();
  await seedDemoUsers();
  await seedAnalyticsCohort();
  await seedForum();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
