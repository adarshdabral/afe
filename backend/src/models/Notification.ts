// Notification model (SRS FR-01 / FR-02) — Mongo-backed replacement for the
// in-memory per-user notification feed in src/lib/auth/registrations.server.ts.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export type NotificationType =
  | "registration_pending"
  | "registration_approved"
  | "registration_rejected";

export interface NotificationView {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string;
  read: boolean;
}

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["registration_pending", "registration_approved", "registration_rejected"],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { timestamps: false },
);

export type NotificationSchemaType = InferSchemaType<typeof notificationSchema>;
export type NotificationDoc = HydratedDocument<NotificationSchemaType>;

export const Notification = model("Notification", notificationSchema);

/** Project a stored notification to the API view. */
export function toNotification(doc: NotificationDoc): NotificationView {
  return {
    id: String(doc._id),
    type: doc.type as NotificationType,
    message: doc.message,
    createdAt: doc.createdAt,
    read: !!doc.read,
  };
}
