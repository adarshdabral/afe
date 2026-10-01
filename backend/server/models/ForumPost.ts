// Forum post model (SRS FR-09) — Mongo-backed replacement for the in-memory
// posts store in src/lib/forum/forum.server.ts. `isAnswer` marks a teacher's
// authoritative response; hidden posts are visible only to staff.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import type { Role } from "../shared/access";

/** API view matching the source `ForumPost`. */
export interface PostView {
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

const forumPostSchema = new Schema(
  {
    threadId: { type: String, required: true, index: true },
    body: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    isAnswer: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { timestamps: false },
);

export type ForumPostSchemaType = InferSchemaType<typeof forumPostSchema>;
export type ForumPostDoc = HydratedDocument<ForumPostSchemaType>;

export const ForumPost = defineModel("ForumPost", forumPostSchema);

/** Project a stored post to the API view. */
export function toPost(doc: ForumPostDoc): PostView {
  return {
    id: String(doc._id),
    threadId: doc.threadId,
    body: doc.body,
    authorId: doc.authorId,
    authorName: doc.authorName,
    authorRole: doc.authorRole as Role,
    isAnswer: !!doc.isAnswer,
    hidden: !!doc.hidden,
    createdAt: doc.createdAt,
  };
}
