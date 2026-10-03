"use client";

// Platform branding (the uploaded logo). Seeded from the server render, then
// refreshed in the browser; the admin Branding page calls setLogoUrl so the new
// logo shows everywhere immediately.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBranding } from "@/lib/api/branding";

interface BrandingState {
  logoUrl: string;
  setLogoUrl: (url: string) => void;
}

const BrandingContext = createContext<BrandingState>({ logoUrl: "", setLogoUrl: () => {} });

export function BrandingProvider({ initialLogoUrl, children }: { initialLogoUrl: string; children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);

  useEffect(() => {
    let cancelled = false;
    getBranding()
      .then((b) => { if (!cancelled) setLogoUrl(b.logoUrl); })
      .catch(() => { /* keep the server value / default mark */ });
    return () => { cancelled = true; };
  }, []);

  return <BrandingContext.Provider value={{ logoUrl, setLogoUrl }}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
