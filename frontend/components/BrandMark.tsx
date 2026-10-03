"use client";

// The platform's brand mark: the logo uploaded in Admin → Branding, or — until one
// is uploaded — the default Sparkles icon in a violet tile. Use this everywhere the
// brand appears instead of a bare <Sparkles />.

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useBranding } from "@/context/BrandingContext";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { PLATFORM_NAME } from "@/lib/course";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "w-8 h-8 rounded-[10px]", icon: "w-4 h-4" },
  md: { box: "w-9 h-9 rounded-xl", icon: "w-5 h-5" },
  lg: { box: "w-16 h-16 rounded-2xl", icon: "w-8 h-8" },
} as const;

interface Props {
  size?: keyof typeof SIZES;
  /** "solid" = violet tile (default); "glass" = translucent tile for dark panels;
   *  "bare" = icon only (no tile). Only affects the default mark. */
  variant?: "solid" | "glass" | "bare";
  className?: string;
}

export function BrandMark({ size = "sm", variant = "solid", className }: Props) {
  const { logoUrl } = useBranding();
  // A logo that fails to load (e.g. a deleted file) falls back to the default mark.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const s = SIZES[size];

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-uploaded origin (R2 / backend)
      <img
        src={resolveUploadUrl(logoUrl)}
        alt={`${PLATFORM_NAME} logo`}
        className={cn(s.box, "object-contain shrink-0", className)}
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }

  if (variant === "bare") return <Sparkles className={cn(s.icon, "text-white", className)} aria-hidden />;

  return (
    <span
      className={cn(
        s.box,
        "flex items-center justify-center shrink-0",
        variant === "glass" ? "bg-white/10 border border-white/15" : "bg-violet-600 text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      <Sparkles className={s.icon} />
    </span>
  );
}
