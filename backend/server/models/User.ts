// User model — the Mongo-backed replacement for the in-memory store in
// src/lib/auth/users.server.ts. `identifiers` holds the lowercased login keys
// (email / username / mobile) so credential lookup is a single indexed query.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import type { Role, RegistrationStatus, SessionPrincipal } from "../shared/access";

const userSchema = new Schema(
  {
    // String ids (matching the original in-memory store) so the fixed teacher
    // directory ("u-teacher") and analytics cohort ("u-student") line up with
    // seeded user ids. Registered users get an auto-generated string id.
    _id: { type: String, default: () => `usr-${crypto.randomUUID()}` },
    role: {
      type: String,
      enum: ["student", "teacher", "platform_admin"],
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    username: { type: String, lowercase: true, trim: true },
    mobile: { type: String, trim: true, default: "" },
    // Teacher profile fields (all optional; managed via /api/admin/teachers).
    designation: { type: String, trim: true, default: "" },
    organization: { type: String, trim: true, default: "" },
    specialization: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "" },
    profilePhoto: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    registrationStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    // Teacher login gate — a deactivated teacher cannot sign in (FR: teachers may
    // log in only while active). Defaults active; not meaningful for other roles.
    active: { type: Boolean, default: true },
    /** Lowercased login identifiers (email/username/mobile). */
    identifiers: { type: [String], default: [], index: true },
  },
  { timestamps: true },
);

export type UserSchemaType = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserSchemaType>;

export const User = defineModel("User", userSchema);

/** Project a stored user down to the session principal shape. */
export function principalOf(doc: UserDoc): SessionPrincipal {
  const role = doc.role as Role;
  const p: SessionPrincipal = {
    id: String(doc._id),
    role,
    name: doc.name,
    email: doc.email ?? "",
  };
  if (role === "student") {
    p.registrationStatus = (doc.registrationStatus as RegistrationStatus) ?? "pending";
  }
  if (role === "teacher") {
    p.active = doc.active !== false; // default-active unless explicitly disabled
  }
  return p;
}
