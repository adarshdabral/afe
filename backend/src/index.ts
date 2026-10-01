import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { seedDemoUsers } from "./seed/users.seed";
import authRoutes from "./routes/auth.routes";
import teacherRoutes from "./routes/teacher.routes";
import adminCourseRoutes from "./routes/admin.course.routes";
import uploadRoutes from "./routes/upload.routes";
import { UPLOAD_DIR } from "./utils/storage";
import courseRoutes from "./routes/course.routes";
import adminAssessmentRoutes from "./routes/admin.assessment.routes";
import assessmentRoutes from "./routes/assessment.routes";
import progressRoutes from "./routes/progress.routes";
import certificateRoutes from "./routes/certificate.routes";
import registrationRoutes from "./routes/registration.routes";
import analyticsRoutes from "./routes/analytics.routes";
import forumRoutes from "./routes/forum.routes";
import reviewRoutes from "./routes/review.routes";
import { seedAnalyticsCohort } from "./seed/analytics.seed";
import { seedForum } from "./seed/forum.seed";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ data: { ok: true } });
});

// Read-only serving of uploaded lesson materials (presentations/PDFs/images/videos).
// express.static honours HTTP Range requests, so uploaded videos can seek/stream.
app.use(
  "/api/uploads",
  express.static(UPLOAD_DIR, { index: false, fallthrough: false, dotfiles: "ignore", maxAge: "7d" }),
);

app.use("/api/auth", authRoutes);
app.use("/api/admin/teachers", teacherRoutes);
app.use("/api/admin/uploads", uploadRoutes);
app.use("/api/admin/courses", adminCourseRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin/assessments", adminAssessmentRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api", reviewRoutes);

// Central error handler — zod validation → 400, everything else → 500.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const anyErr = err as {
      name?: string;
      message?: string;
      issues?: unknown;
      code?: string;
      statusCode?: number;
    };
    if (anyErr?.name === "ZodError") {
      res.status(400).json({ error: { message: "Invalid request.", issues: anyErr.issues } });
      return;
    }
    // multer upload errors (size / unexpected field).
    if (anyErr?.name === "MulterError") {
      const tooBig = anyErr.code === "LIMIT_FILE_SIZE";
      res.status(tooBig ? 413 : 400).json({
        error: { message: tooBig ? "File is too large." : (anyErr.message ?? "Upload failed.") },
      });
      return;
    }
    // Errors that carry an explicit HTTP status (e.g. 415 from the upload filter).
    if (typeof anyErr?.statusCode === "number") {
      res.status(anyErr.statusCode).json({ error: { message: anyErr.message ?? "Request failed." } });
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
