// Standalone seed runner: `npm run seed`. Seeds the demo accounts, then
// standardizes course content to the single "Demystifying AI for Everyone" course.
// `--keep-others` (`npm run seed:flagship`) (re)builds only that course and
// leaves every other course untouched.

import { connectDb } from "../config/db";
import { seedDemoUsers } from "./users.seed";
import { seedAiCourse } from "./course.seed";
import { migrateLessonsToTopics } from "../migrations/lessons-to-topics";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  await migrateLessonsToTopics(); // bring older data to Course → Module → Lesson → Topic first
  await seedDemoUsers();
  const archiveOthers = !process.argv.includes("--keep-others");
  const course = await seedAiCourse({ archiveOthers });
  console.log(
    `Course standardized → "${course.slug}" with ${course.modules} modules; archived ${course.archivedOthers} other course(s).`,
  );
  await mongoose.disconnect();
  console.log("Seed complete.");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
