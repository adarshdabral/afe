// Frontend forum service — replaces the TanStack forum.functions.ts callables
// with Axios calls to the API (backend app, via the /api rewrite).

import { api } from "./axios";
import type { Role } from "./auth";

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
  isAnswer: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface ThreadListItem extends ForumThread {
  replyCount: number;
  hasTeacherAnswer: boolean;
}

export interface ThreadList {
  items: ThreadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listThreads(params: { search?: string; page?: number }): Promise<ThreadList> {
  const { data } = await api.get<{ data: ThreadList }>("/forum/threads", {
    params: { search: params.search || undefined, page: params.page ?? 1 },
  });
  return data.data;
}

export async function getThread(
  threadId: string,
): Promise<{ thread: ForumThread; posts: ForumPost[] } | null> {
  const { data } = await api.get<{ data: { thread: ForumThread; posts: ForumPost[] } | null }>(
    `/forum/threads/${encodeURIComponent(threadId)}`,
  );
  return data.data;
}

export async function createThread(input: {
  title: string;
  body: string;
  moduleId?: string;
}): Promise<ForumThread> {
  const { data } = await api.post<{ data: ForumThread }>("/forum/threads", input);
  return data.data;
}

export async function reply(input: {
  threadId: string;
  body: string;
  asAnswer?: boolean;
}): Promise<ForumPost> {
  const { data } = await api.post<{ data: ForumPost }>(
    `/forum/threads/${encodeURIComponent(input.threadId)}/replies`,
    { body: input.body, asAnswer: input.asAnswer },
  );
  return data.data;
}

export async function moderateThread(input: {
  threadId: string;
  hidden: boolean;
}): Promise<ForumThread> {
  const { data } = await api.post<{ data: ForumThread }>(
    `/forum/threads/${encodeURIComponent(input.threadId)}/moderate`,
    { hidden: input.hidden },
  );
  return data.data;
}

export async function moderatePost(input: { postId: string; hidden: boolean }): Promise<ForumPost> {
  const { data } = await api.post<{ data: ForumPost }>(
    `/forum/posts/${encodeURIComponent(input.postId)}/moderate`,
    { hidden: input.hidden },
  );
  return data.data;
}
