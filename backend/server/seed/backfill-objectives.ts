// Non-destructive backfill: give existing "AI for Everyone" modules their learning
// objectives (by module title) WITHOUT rebuilding the course — lessons, assessments
// and student progress are untouched. Only modules with no objectives are changed.
//
//   npm run backfill:objectives
import { connectDb } from "../config/db";
import { Course } from "../models/Course";
import { Module } from "../models/Module";
import { AI_COURSE_META, MODULE_LEARNING_OBJECTIVES } from "./ai-course.data";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  const course = await Course.findOne({ slug: AI_COURSE_META.slug, deletedAt: null });
  if (!course) {
    console.log(`No live course with slug "${AI_COURSE_META.slug}" — nothing to do.`);
  } else {
    const modules = await Module.find({ courseId: String(course._id) }).sort({ order: 1 });
    let updated = 0;
    for (const m of modules) {
      const objectives = MODULE_LEARNING_OBJECTIVES[m.title];
      if (!objectives || (m.learningObjectives ?? []).length > 0) continue;
      m.set("learningObjectives", objectives);
      await m.save();
      updated += 1;
      console.log(`  + ${m.title} (${objectives.length} objectives)`);
    }
    const missing = modules.filter((m) => !MODULE_LEARNING_OBJECTIVES[m.title] && !(m.learningObjectives ?? []).length);
    console.log(`Updated ${updated} of ${modules.length} module(s).`);
    if (missing.length) console.log(`No objectives on file for: ${missing.map((m) => `"${m.title}"`).join(", ")} — add them in the CMS.`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
