// Platform-wide settings editable by platform admins (currently: branding).
// Stored as a single document per settings group, keyed by a fixed string id
// (e.g. "branding"), so reads are one findById and writes are an upsert.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface BrandingView {
  /** Logo image URL ("" = none → the UI shows the default Sparkles mark). Either a
   *  root-relative "/api/uploads/…" path (local storage) or an absolute R2 URL. */
  logoUrl: string;
  updatedAt: string | null;
}

const siteSettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    logoUrl: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

export type SiteSettingDoc = HydratedDocument<InferSchemaType<typeof siteSettingSchema>>;
export const SiteSetting = defineModel("SiteSetting", siteSettingSchema);

export function toBranding(doc: SiteSettingDoc | null): BrandingView {
  return {
    logoUrl: doc?.logoUrl ?? "",
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}
