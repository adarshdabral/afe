// Server-only: the platform logo for the first render (so pages don't flash the
// default mark before the logo loads). Cached for a minute; returns "" when the
// backend is unreachable/asleep — the client BrandingProvider then fetches it.

import { BACKEND_URL } from "@/lib/backend";

export async function getServerLogoUrl(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/branding`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { data?: { logoUrl?: string } };
    return json.data?.logoUrl ?? "";
  } catch {
    return "";
  }
}
