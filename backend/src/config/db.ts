import mongoose from "mongoose";
import { env } from "./env";

export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  return mongoose;
}
