// Forum service (SRS FR-09) — Mongo-backed port of src/lib/forum/forum.server.ts.
// Hidden content (threads + posts) is visible only to staff, and only staff
// replies can be marked as the authoritative answer.

import { ForumThread, toThread, type ThreadView } from "../models/ForumThread";
import { ForumPost, toPost, type PostView } from "../models/ForumPost";
import type { Role } from "../shared/access";

export const PAGE_SIZE = 5;

export interface ThreadListItem extends ThreadView {
  replyCount: number;
  hasTeacherAnswer: boolean;
}

export interface Author {
  id: string;
  name: string;
  role: Role;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function isStaff(role: Role): boolean {
  return role === "teacher" || role === "platform_admin";
}

/** Posts for a thread, oldest-first; hidden posts only for staff viewers. */
export async function visiblePosts(threadId: string, viewerRole: Role): Promise<PostView[]> {
  const staff = isStaff(viewerRole);
  const filter: Record<string, unknown> = { threadId };
  if (!staff) filter.hidden = false;
  const docs = await ForumPost.find(filter).sort({ createdAt: 1 });
  return docs.map(toPost);
}

export interface ListParams {
  search?: string;
  page?: number;
  viewerRole: Role;
}

export async function listThreads({
  search = "",
  page = 1,
  viewerRole,
}: ListParams): Promise<{
  items: ThreadListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const staff = isStaff(viewerRole);
  const needle = search.trim();

  const filter: Record<string, unknown> = {};
  if (!staff) filter.hidden = false;
  if (needle) {
    const rx = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: rx }, { body: rx }];
  }

  const total = await ForumThread.countDocuments(filter);
  const start = (page - 1) * PAGE_SIZE;
  const docs = await ForumThread.find(filter)
    .sort({ createdAt: -1 }) // newest first
    .skip(start)
    .limit(PAGE_SIZE);

  const items: ThreadListItem[] = [];
  for (const doc of docs) {
    const thread = toThread(doc);
    const replies = await visiblePosts(thread.id, viewerRole);
    items.push({
      ...thread,
      replyCount: replies.length,
      hasTeacherAnswer: replies.some((p) => p.isAnswer),
    });
  }

  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function getThread(
  threadId: string,
  viewerRole: Role,
): Promise<{ thread: ThreadView; posts: PostView[] } | null> {
  const doc = await ForumThread.findById(threadId).catch(() => null);
  if (!doc || (doc.hidden && !isStaff(viewerRole))) return null;
  return { thread: toThread(doc), posts: await visiblePosts(threadId, viewerRole) };
}

export async function createThread(
  author: Author,
  input: { title: string; body: string; moduleId?: string | null },
): Promise<ThreadView> {
  const doc = await ForumThread.create({
    title: input.title.trim(),
    body: input.body.trim(),
    moduleId: input.moduleId || null,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    createdAt: nowIso(),
    hidden: false,
  });
  return toThread(doc);
}

export async function addReply(
  author: Author,
  input: { threadId: string; body: string; asAnswer?: boolean },
): Promise<PostView> {
  const thread = await ForumThread.findById(input.threadId).catch(() => null);
  if (!thread) throw new Error("Thread not found.");
  const doc = await ForumPost.create({
    threadId: input.threadId,
    body: input.body.trim(),
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    // Only staff replies can be marked as the authoritative answer (FR-09).
    isAnswer: !!input.asAnswer && isStaff(author.role),
    hidden: false,
    createdAt: nowIso(),
  });
  return toPost(doc);
}

export async function setThreadHidden(threadId: string, hidden: boolean): Promise<ThreadView> {
  const doc = await ForumThread.findById(threadId).catch(() => null);
  if (!doc) throw new Error("Thread not found.");
  doc.hidden = hidden;
  await doc.save();
  return toThread(doc);
}

export async function setPostHidden(postId: string, hidden: boolean): Promise<PostView> {
  const doc = await ForumPost.findById(postId).catch(() => null);
  if (!doc) throw new Error("Post not found.");
  doc.hidden = hidden;
  await doc.save();
  return toPost(doc);
}

// ── Course discussions ──────────────────────────────────────────────────────
// A "discussion" topic is backed by ONE thread in this forum (ForumThread.topicId),
// so learners participate through the regular forum (replies, moderation, answers).

/** Create or update the thread behind a discussion topic (title/prompt kept in sync). */
export async function ensureDiscussionThread(
  topic: { id: string; courseId: string; moduleId: string; title: string; description: string; discussion: { prompt: string } },
  author: Author,
): Promise<ThreadView> {
  const body = topic.discussion.prompt.trim() || topic.description.trim() || topic.title;
  const existing = await ForumThread.findOne({ topicId: topic.id });
  if (existing) {
    existing.title = topic.title;
    existing.body = body;
    existing.moduleId = topic.moduleId;
    existing.courseId = topic.courseId;
    existing.hidden = false;
    await existing.save();
    return toThread(existing);
  }
  const doc = await ForumThread.create({
    title: topic.title,
    body,
    moduleId: topic.moduleId,
    topicId: topic.id,
    courseId: topic.courseId,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    createdAt: nowIso(),
    hidden: false,
  });
  return toThread(doc);
}

/** Hide a discussion's thread (its topic was deleted or is no longer a discussion). Posts are kept. */
export async function hideDiscussionThread(topicId: string): Promise<void> {
  await ForumThread.updateOne({ topicId }, { $set: { hidden: true } });
}

/** The visible thread id behind a discussion topic, or null. */
export async function discussionThreadId(topicId: string): Promise<string | null> {
  const t = await ForumThread.findOne({ topicId, hidden: false }).select("_id").lean();
  return t ? String(t._id) : null;
}

/** The (course, topic) a thread belongs to, when it is a course discussion. */
export async function threadDiscussion(threadId: string): Promise<{ topicId: string; courseId: string } | null> {
  const t = await ForumThread.findById(threadId).select("topicId courseId").lean().catch(() => null);
  return t?.topicId && t.courseId ? { topicId: t.topicId, courseId: t.courseId } : null;
}
