// Branding service — the platform logo shown in place of the default Sparkles mark.

import { SiteSetting, toBranding, type BrandingView } from "../models/SiteSetting";
import { cachedContent } from "../cache/content-cache";

const BRANDING_ID = "branding";

/** Read on every page render — cached (invalidated when the logo changes). */
export function getBranding(): Promise<BrandingView> {
  return cachedContent("branding", async () => toBranding(await SiteSetting.findById(BRANDING_ID)));
}

/** Set (or clear, with "") the logo. */
export async function setLogo(logoUrl: string, adminId: string): Promise<BrandingView> {
  const doc = await SiteSetting.findByIdAndUpdate(
    BRANDING_ID,
    { $set: { logoUrl, updatedBy: adminId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return toBranding(doc);
}
