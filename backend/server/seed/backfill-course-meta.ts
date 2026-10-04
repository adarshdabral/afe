// Non-destructive backfill for course-page metadata, WITHOUT rebuilding any course.
// Only EMPTY values are filled, so anything an admin has already edited is left
// alone. Student progress, lessons, topics and questions are untouched.
//   - Every live course: instructor and "Offered by" (platform-wide facts).
//   - The flagship course only: "Skills you'll gain", "Tools you'll learn" and its
//     module assessments' time estimates (course-specific — other courses get
//     theirs in Admin → Courses → Course page details).
//
//   npm run backfill:course-meta
import { connectDb } from "../config/db";
import { Course } from "../models/Course";
import { Assessment } from "../models/Assessment";
import { AI_COURSE_META, MODULE_ASSESSMENT_MINUTES } from "./ai-course.data";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  const courses = await Course.find({ deletedAt: null });
  if (courses.length === 0) console.log("No live courses — nothing to do.");
  for (const course of courses) {
    const isFlagship = course.slug === AI_COURSE_META.slug;
    const filled: string[] = [];
    if (!course.instructor) {
      course.instructor = AI_COURSE_META.instructor;
      filled.push("instructor");
    }
    if (!course.offeredBy?.name) {
      course.set("offeredBy", { ...AI_COURSE_META.offeredBy, logoUrl: course.offeredBy?.logoUrl || AI_COURSE_META.offeredBy.logoUrl });
      filled.push("offeredBy");
    }
    if (isFlagship && !(course.skills ?? []).length) {
      course.set("skills", AI_COURSE_META.skills);
      filled.push("skills");
    }
    if (isFlagship && !(course.tools ?? []).length) {
      course.set("tools", AI_COURSE_META.tools);
      filled.push("tools");
    }
    if (filled.length) await course.save();
    console.log(`${course.slug}: ${filled.length ? `filled ${filled.join(", ")}` : "metadata already set"}.`);

    if (isFlagship) {
      const res = await Assessment.updateMany(
        { courseId: String(course._id), $or: [{ estimatedDurationMinutes: { $exists: false } }, { estimatedDurationMinutes: 0 }] },
        { $set: { estimatedDurationMinutes: MODULE_ASSESSMENT_MINUTES } },
      );
      console.log(`${course.slug}: set a ${MODULE_ASSESSMENT_MINUTES}-min estimate on ${res.modifiedCount} assessment(s).`);
    }
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
