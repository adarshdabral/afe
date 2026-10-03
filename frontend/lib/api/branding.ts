// Frontend branding service — the platform logo (Axios, via the /api rewrite).
// Mirrors backend/server/services/branding.service.ts.

import { api } from "./axios";

export interface Branding {
  /** "" = no logo uploaded → the default Sparkles mark is shown. */
  logoUrl: string;
  updatedAt: string | null;
}

export async function getBranding(): Promise<Branding> {
  const res = await api.get<{ data: Branding }>("/branding");
  return res.data.data;
}

/** Platform admin: set the logo to an uploaded image URL, or "" to remove it. */
export async function updateBranding(logoUrl: string): Promise<Branding> {
  const res = await api.put<{ data: Branding }>("/admin/branding", { logoUrl });
  return res.data.data;
}
