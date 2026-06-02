// Boots ephemeral Mongo + the Express API on :4000 and stays alive (for manual probing).
import { MongoMemoryServer } from "mongodb-memory-server";
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = "4000";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await import("../src/index.ts");
setInterval(() => {}, 1 << 30);
