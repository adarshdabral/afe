// Standalone seed runner: `bun run seed` / `npm run seed`. Auth scope only —
// seeds the four demo accounts, then exits.

import { connectDb } from "../config/db";
import { seedDemoUsers } from "./users.seed";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  await seedDemoUsers();
  await mongoose.disconnect();
  console.log("Seed complete.");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
