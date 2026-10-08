// CLI for the course importer (server/seed/course-import.ts). Idempotent and
// additive — safe to re-run; `--dry-run` prints the planned changes without writing.
//
//   npm run import:course -- [--file <json>] [--course-slug <slug>] [--course-key <key>] [--dry-run]
//
// Defaults: the Demystifying AI five-week plan, imported into the flagship course.
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "../config/db";
import { User } from "../models/User";
import { importCourse, type SourceCourse } from "./course-import";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function run(): Promise<void> {
  const file = arg("file") ?? path.join(process.cwd(), "server/data/imports/demystifying-ai-five-week.json");
  const src = JSON.parse(fs.readFileSync(file, "utf8")) as SourceCourse;
  const dryRun = process.argv.includes("--dry-run");
  const mongoose = await connectDb();
  const admin = (await User.findOne({ role: "platform_admin" }).sort({ createdAt: 1 })) ?? null;
  if (!admin) throw new Error("No platform admin user found to own the imported content.");
  const report = await importCourse(src, {
    courseSlug: arg("course-slug") ?? "demystifying-ai-for-everyone",
    courseKey: arg("course-key") ?? "demystifying-ai-five-week",
    createdBy: String(admin._id),
    authorName: (admin as { name?: string }).name,
    dryRun,
  });
  console.log(report.actions.join("\n"));
  console.log(`\n${dryRun ? "DRY RUN — nothing was written." : "Import complete."}`);
  console.log("Created:", JSON.stringify(report.created));
  console.log("Matched:", JSON.stringify(report.matched));
  console.log(`\nNeeds content (${report.needsContent.length}):\n- ${report.needsContent.join("\n- ")}`);
  console.log(`\nWarnings (${report.warnings.length}):\n- ${report.warnings.join("\n- ")}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
