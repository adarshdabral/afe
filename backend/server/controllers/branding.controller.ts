// Branding controllers. `get` is public (every page renders the logo); `update`
// is mounted behind ADMIN (platform_admin only).

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { getBranding, setLogo } from "../services/branding.service";

// A logo is an uploaded file: a local "/api/uploads/<file>" path or an absolute
// https URL (Cloudflare R2). "" removes the logo. No other schemes (javascript:, data:).
const logoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^\/api\/uploads\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(v) && !v.includes("..") || /^https:\/\/\S+$/.test(v), {
    message: "Logo must be an uploaded image URL.",
  });
const updateSchema = z.object({ logoUrl: logoUrlSchema });

/** GET /api/branding */
export async function get(_req: Request, res: Response): Promise<void> {
  res.json({ data: await getBranding() });
}

/** PUT /api/admin/branding — { logoUrl } ("" clears it). */
export async function update(req: Request, res: Response): Promise<void> {
  const { logoUrl } = updateSchema.parse(req.body);
  res.json({ data: await setLogo(logoUrl, req.user!.id) });
}
