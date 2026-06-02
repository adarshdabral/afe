// SERVER-ONLY discussion forum store (SRS FR-09). Shared across sessions so a
// teacher sees and answers what students post (client localStorage can't do
// that). In-memory today — the DB seam for the future `forum_threads` /
// `forum_posts` tables. Hidden = moderated-out; only staff (teachers/admins)
// can see and toggle hidden content.

import type { Role } from "@/lib/auth/access";

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  moduleId: string | null;
  authorId: string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
  hidden: boolean;
}

export interface ForumPost {
  id: string;
  threadId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  isAnswer: boolean; // teacher's authoritative response
  hidden: boolean;
  createdAt: string;
}

export interface ThreadListItem extends ForumThread {
  replyCount: number;
  hasTeacherAnswer: boolean;
}

export const PAGE_SIZE = 5;

const threads = new Map<string, ForumThread>();
const posts = new Map<string, ForumPost>();

function nowIso() {
  return new Date().toISOString();
}

// ---- Seed a little activity so the forum isn't empty --------------------------
function seed() {
  if (threads.size) return;
  const t1: ForumThread = {
    id: "th-seed-1",
    title: "Is any maths needed for Module 2 (How AI Learns)?",
    body: "I'm a bit worried about the data and model parts — do I need calculus or statistics first?",
    moduleId: "m2",
    authorId: "u-student",
    authorName: "Aarav Singh",
    authorRole: "student",
    createdAt: "2026-05-28T09:00:00.000Z",
    hidden: false,
  };
  const t2: ForumThread = {
    id: "th-seed-2",
    title: "Good free tools to try after Module 7?",
    body: "Besides ChatGPT and Perplexity, what else is beginner-friendly and free?",
    moduleId: "m7",
    authorId: "u-student",
    authorName: "Aarav Singh",
    authorRole: "student",
    createdAt: "2026-05-29T14:30:00.000Z",
    hidden: false,
  };
  threads.set(t1.id, t1);
  threads.set(t2.id, t2);
  const p1: ForumPost = {
    id: "po-seed-1",
    threadId: "th-seed-1",
    body: "No prerequisites needed — Module 2 builds intuition first. We avoid heavy maths and focus on ideas like data, bias, and overfitting.",
    authorId: "u-teacher",
    authorName: "Dr. Priya Sharma",
    authorRole: "teacher",
    isAnswer: true,
    hidden: false,
    createdAt: "2026-05-28T11:15:00.000Z",
  };
  posts.set(p1.id, p1);
}

function isStaff(role: Role): boolean {
  return role === "teacher" || role === "school_admin" || role === "platform_admin";
}

function visiblePosts(threadId: string, viewerRole: Role): ForumPost[] {
  const staff = isStaff(viewerRole);
  return [...posts.values()]
    .filter((p) => p.threadId === threadId && (staff || !p.hidden))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export interface ListParams {
  search?: string;
  page?: number;
  viewerRole: Role;
}

export function listThreads({ search = "", page = 1, viewerRole }: ListParams) {
  seed();
  const staff = isStaff(viewerRole);
  const needle = search.trim().toLowerCase();

  let all = [...threads.values()].filter((t) => staff || !t.hidden);
  if (needle) {
    all = all.filter(
      (t) => t.title.toLowerCase().includes(needle) || t.body.toLowerCase().includes(needle),
    );
  }
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first

  const total = all.length;
  const start = (page - 1) * PAGE_SIZE;
  const items: ThreadListItem[] = all.slice(start, start + PAGE_SIZE).map((t) => {
    const replies = visiblePosts(t.id, viewerRole);
    return {
      ...t,
      replyCount: replies.length,
      hasTeacherAnswer: replies.some((p) => p.isAnswer),
    };
  });

  return { items, total, page, pageSize: PAGE_SIZE };
}

export function getThread(threadId: string, viewerRole: Role) {
  seed();
  const thread = threads.get(threadId);
  if (!thread || (thread.hidden && !isStaff(viewerRole))) return null;
  return { thread, posts: visiblePosts(threadId, viewerRole) };
}

export interface Author {
  id: string;
  name: string;
  role: Role;
}

export function createThread(
  author: Author,
  input: { title: string; body: string; moduleId?: string | null },
): ForumThread {
  const thread: ForumThread = {
    id: `th-${crypto.randomUUID()}`,
    title: input.title.trim(),
    body: input.body.trim(),
    moduleId: input.moduleId || null,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    createdAt: nowIso(),
    hidden: false,
  };
  threads.set(thread.id, thread);
  return thread;
}

export function addReply(
  author: Author,
  input: { threadId: string; body: string; asAnswer?: boolean },
): ForumPost {
  const thread = threads.get(input.threadId);
  if (!thread) throw new Error("Thread not found.");
  const post: ForumPost = {
    id: `po-${crypto.randomUUID()}`,
    threadId: input.threadId,
    body: input.body.trim(),
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    // Only staff replies can be marked as the authoritative answer (FR-09).
    isAnswer: !!input.asAnswer && isStaff(author.role),
    hidden: false,
    createdAt: nowIso(),
  };
  posts.set(post.id, post);
  return post;
}

export function setThreadHidden(threadId: string, hidden: boolean): ForumThread {
  const thread = threads.get(threadId);
  if (!thread) throw new Error("Thread not found.");
  thread.hidden = hidden;
  return thread;
}

export function setPostHidden(postId: string, hidden: boolean): ForumPost {
  const post = posts.get(postId);
  if (!post) throw new Error("Post not found.");
  post.hidden = hidden;
  return post;
}
