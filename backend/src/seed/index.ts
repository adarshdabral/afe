// Standalone seed runner: `npm run seed`. Seeds the demo accounts, then
// standardizes course content to the single "AI for Everyone" course.

import { connectDb } from "../config/db";
import { seedDemoUsers } from "./users.seed";
import { seedAiCourse } from "./course.seed";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  await seedDemoUsers();
  const course = await seedAiCourse();
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
