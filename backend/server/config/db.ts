import mongoose from "mongoose";
import { env } from "./env";

// One connection per process. Cached on globalThis so Next.js dev hot-reloads
// (and any second copy of this module, e.g. verify harnesses) reuse it instead
// of opening new connections.
const g = globalThis as typeof globalThis & { __afeDb?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!g.__afeDb) {
    mongoose.set("strictQuery", true);
    g.__afeDb = mongoose.connect(env.mongoUri).catch((err) => {
      g.__afeDb = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return g.__afeDb;
}
