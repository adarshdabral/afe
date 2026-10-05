// Turn "Download allowed" ON for every existing topic (text, video, audio, PDF/PPT,
// subtitles). New topics default to on; admins can still switch it off per topic.
// Media hosted elsewhere (YouTube, Vimeo) can't be downloaded either way.
//
//   npm run enable:downloads
import { connectDb } from "../config/db";
import { Topic } from "../models/Topic";

async function run(): Promise<void> {
  const mongoose = await connectDb();
  const res = await Topic.updateMany({ allowDownload: { $ne: true } }, { $set: { allowDownload: true } });
  const total = await Topic.countDocuments({});
  console.log(`Downloads enabled on ${res.modifiedCount} topic(s); ${total} topic(s) in total now allow downloads.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Enabling downloads failed:", err);
  process.exit(1);
});
