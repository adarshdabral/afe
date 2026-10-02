// Boots ephemeral Mongo + the full Next.js app (pages + API) on :3100 and stays alive (manual probing).
// The UI is at http://localhost:3100, the API at http://localhost:3100/api. Seeds the  Demystifying AI for Everyone course.
import { MongoMemoryServer } from "mongodb-memory-server";
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = process.env.PORT ?? "3100";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await (await import("./_server.mts")).startServer();
await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`); // connect + startup seeds
const { seedAiCourse } = await import("../server/seed/course.seed.ts");
await seedAiCourse();
console.log(`Ready → http://localhost:${process.env.PORT}  (student@afe.edu / Student@123, Moocs@admin / Admin@123)`);
setInterval(() => {}, 1 << 30);
