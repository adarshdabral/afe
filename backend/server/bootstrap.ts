// Server bootstrap: connect to MongoDB, apply data migrations, and run the idempotent startup seeds
// (demo users, analytics cohort, forum) exactly once per process. Called from
// instrumentation.ts at server start and awaited by every API handler, so a
// request never runs before the database is ready.

import { connectDb } from "./config/db";
import { env } from "./config/env";
import { seedDemoUsers } from "./seed/users.seed";
import { seedAnalyticsCohort } from "./seed/analytics.seed";
import { seedForum } from "./seed/forum.seed";
import { migrateLessonsToTopics } from "./migrations/lessons-to-topics";

const g = globalThis as typeof globalThis & { __afeReady?: Promise<void> };

export function ensureServerReady(): Promise<void> {
  if (!g.__afeReady) {
    g.__afeReady = (async () => {
      void env.jwtSecret; // throws in production when JWT_SECRET is missing/short
      await connectDb();
      await migrateLessonsToTopics(); // idempotent; must run before anything reads topics
      await seedDemoUsers();
      await seedAnalyticsCohort();
      await seedForum();
    })().catch((err) => {
      g.__afeReady = undefined; // retry on the next request (e.g. DB was briefly down)
      throw err;
    });
  }
  return g.__afeReady;
}
