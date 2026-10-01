// Forum controllers (SRS FR-09) — ported from src/lib/forum/forum.functions.ts.
// The viewer's role and author identity come from the authenticated session
// (req.user), never the client. Hidden/answer/moderation rights are enforced in
// the service layer.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  addReply,
  createThread,
  getThread,
  listThreads,
  setPostHidden,
  setThreadHidden,
  type Author,
} from "../services/forum.service";
import { getUserById } from "../services/auth.service";
import type { Role } from "../shared/access";

const STAFF: Role[] = ["teacher", "platform_admin"];
void STAFF; // route-level requireRole enforces staff access for moderation.

/** Resolve the author identity (incl. display name) from the session. */
async function authorOf(req: Request): Promise<Author> {
  const user = req.user!;
  const principal = await getUserById(user.id);
  return { id: user.id, name: principal?.name ?? "", role: user.role };
}

const listSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

/** GET /api/forum/threads — any authenticated user. */
export async function list(req: Request, res: Response): Promise<void> {
  const data = listSchema.parse(req.query);
  const result = await listThreads({
    search: data.search,
    page: data.page ?? 1,
    viewerRole: req.user!.role,
  });
  res.json({ data: result });
}

/** GET /api/forum/threads/:id — any authenticated user; null if hidden/missing. */
export async function get(req: Request, res: Response): Promise<void> {
  const threadId = z.string().min(1).parse(req.params.id);
  const result = await getThread(threadId, req.user!.role);
  res.json({ data: result }); // matches the original which returned null
}

const createSchema = z.object({
  title: z.string().min(4).max(160),
  body: z.string().min(1).max(4000),
  moduleId: z.string().optional(),
});

/** POST /api/forum/threads — any authenticated learner or staff. */
export async function create(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  const author = await authorOf(req);
  const thread = await createThread(author, data);
  res.json({ data: thread });
}

const replySchema = z.object({
  body: z.string().min(1).max(4000),
  asAnswer: z.boolean().optional(),
});

/** POST /api/forum/threads/:id/replies — any authenticated user. */
export async function reply(req: Request, res: Response): Promise<void> {
  const threadId = z.string().min(1).parse(req.params.id);
  const data = replySchema.parse(req.body);
  const author = await authorOf(req);
  // `asAnswer` is only honored for staff (enforced again in the service).
  const post = await addReply(author, { threadId, body: data.body, asAnswer: data.asAnswer });
  res.json({ data: post });
}

const moderateSchema = z.object({ hidden: z.boolean() });

/** POST /api/forum/threads/:id/moderate — STAFF only (enforced by route). */
export async function moderateThread(req: Request, res: Response): Promise<void> {
  const threadId = z.string().min(1).parse(req.params.id);
  const { hidden } = moderateSchema.parse(req.body);
  const thread = await setThreadHidden(threadId, hidden);
  res.json({ data: thread });
}

/** POST /api/forum/posts/:id/moderate — STAFF only (enforced by route). */
export async function moderatePost(req: Request, res: Response): Promise<void> {
  const postId = z.string().min(1).parse(req.params.id);
  const { hidden } = moderateSchema.parse(req.body);
  const post = await setPostHidden(postId, hidden);
  res.json({ data: post });
}
