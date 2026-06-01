// Discussion-forum RPC surface (SRS FR-09). Handler bodies + their `*.server.ts`
// imports are server-only and tree-shaken from the client bundle. The viewer's
// role is taken from the session (never the client) so hidden/moderated content
// and answer/moderation rights are enforced server-side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Request-scoped server utility, not a React hook (alias avoids the
// react-hooks/rules-of-hooks lint in the helper below).
import { useAppSession as resolveSession } from "@/lib/auth/session.server";
import type { CurrentUser } from "@/lib/auth/auth.functions";
import type { Role } from "@/lib/auth/access";
import {
  addReply,
  createThread,
  getThread,
  listThreads,
  setPostHidden,
  setThreadHidden,
  type Author,
  type ForumPost,
  type ForumThread,
  type ThreadListItem,
} from "./forum.server";

// Re-export the view types so client code imports them from the RPC module
// (not the server-only store).
export type { ForumPost, ForumThread, ThreadListItem } from "./forum.server";

async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = (await resolveSession()).data.user;
  if (!user) throw new Error("Not authenticated.");
  if (roles && !roles.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

const STAFF: Role[] = ["teacher", "school_admin", "platform_admin"];

function authorOf(user: CurrentUser): Author {
  return { id: user.id, name: user.name, role: user.role };
}

export const listThreadsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ search: z.string().optional(), page: z.number().int().min(1).optional() }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ items: ThreadListItem[]; total: number; page: number; pageSize: number }> => {
      const user = await requireUser();
      return listThreads({ search: data.search, page: data.page ?? 1, viewerRole: user.role });
    },
  );

export const getThreadFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ threadId: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ thread: ForumThread; posts: ForumPost[] } | null> => {
    const user = await requireUser();
    return getThread(data.threadId, user.role);
  });

export const createThreadFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(4).max(160),
      body: z.string().min(1).max(4000),
      moduleId: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<ForumThread> => {
    const user = await requireUser(); // any authenticated learner or staff may ask
    return createThread(authorOf(user), data);
  });

export const replyFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      threadId: z.string().min(1),
      body: z.string().min(1).max(4000),
      asAnswer: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<ForumPost> => {
    const user = await requireUser();
    // `asAnswer` is only honored for staff (enforced again in the store).
    return addReply(authorOf(user), data);
  });

export const moderateThreadFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ threadId: z.string().min(1), hidden: z.boolean() }))
  .handler(async ({ data }): Promise<ForumThread> => {
    await requireUser(STAFF);
    return setThreadHidden(data.threadId, data.hidden);
  });

export const moderatePostFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ postId: z.string().min(1), hidden: z.boolean() }))
  .handler(async ({ data }): Promise<ForumPost> => {
    await requireUser(STAFF);
    return setPostHidden(data.postId, data.hidden);
  });
