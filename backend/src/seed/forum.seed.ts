// Seed a little forum activity so the discussion board isn't empty — ported
// verbatim from the seed() in src/lib/forum/forum.server.ts (same titles, bodies,
// authors and dates). Idempotent: skips entirely if any threads already exist.

import { ForumThread } from "../models/ForumThread";
import { ForumPost } from "../models/ForumPost";

export async function seedForum(): Promise<void> {
  if (await ForumThread.countDocuments()) return;

  const t1 = await ForumThread.create({
    title: "Is any maths needed for Module 2 (How AI Learns)?",
    body: "I'm a bit worried about the data and model parts — do I need calculus or statistics first?",
    moduleId: "m2",
    authorId: "u-student",
    authorName: "Aarav Singh",
    authorRole: "student",
    createdAt: "2026-05-28T09:00:00.000Z",
    hidden: false,
  });

  await ForumThread.create({
    title: "Good free tools to try after Module 7?",
    body: "Besides ChatGPT and Perplexity, what else is beginner-friendly and free?",
    moduleId: "m7",
    authorId: "u-student",
    authorName: "Aarav Singh",
    authorRole: "student",
    createdAt: "2026-05-29T14:30:00.000Z",
    hidden: false,
  });

  await ForumPost.create({
    threadId: String(t1._id),
    body: "No prerequisites needed — Module 2 builds intuition first. We avoid heavy maths and focus on ideas like data, bias, and overfitting.",
    authorId: "u-teacher",
    authorName: "Dr Sudhanshu Joshi",
    authorRole: "teacher",
    isAnswer: true,
    hidden: false,
    createdAt: "2026-05-28T11:15:00.000Z",
  });
}
