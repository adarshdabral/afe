// Writes the flagship's "Meet the Instructor" section (AI_COURSE_META.instructorProfile)
// to an existing database WITHOUT rebuilding the course. Overwrites that section's
// text only; media, other sections and student data are untouched.
//
//   npm run update:instructor
import { connectDb } from "../config/db";
import { Course } from "../models/Course";
import { updateSection } from "../services/section.service";
import { AI_COURSE_META } from "./ai-course.data";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  const course = await Course.findOne({ slug: AI_COURSE_META.slug, deletedAt: null });
  if (!course) {
    console.log(`No live "${AI_COURSE_META.slug}" course — nothing to do.`);
  } else {
    await updateSection(String(course._id), "instructor", { contentType: "rich_text", content: AI_COURSE_META.instructorProfile });
    console.log(`${course.slug}: instructor profile updated.`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
