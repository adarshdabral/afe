// Forum thread model (SRS FR-09) — Mongo-backed replacement for the in-memory
// threads store in src/lib/forum/forum.server.ts. Hidden = moderated-out; only
// staff (teachers/admins) can see and toggle hidden content.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { Role } from "../shared/access";

/** API view matching the source `ForumThread`. */
export interface ThreadView {
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

const forumThreadSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    moduleId: { type: String, default: null },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    createdAt: { type: String, required: true },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: false },
);

export type ForumThreadSchemaType = InferSchemaType<typeof forumThreadSchema>;
export type ForumThreadDoc = HydratedDocument<ForumThreadSchemaType>;

export const ForumThread = model("ForumThread", forumThreadSchema);

/** Project a stored thread to the API view. */
export function toThread(doc: ForumThreadDoc): ThreadView {
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    moduleId: doc.moduleId ?? null,
    authorId: doc.authorId,
    authorName: doc.authorName,
    authorRole: doc.authorRole as Role,
    createdAt: doc.createdAt,
    hidden: !!doc.hidden,
  };
}
