"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Look up a certificate by ID → the existing public /certificate/verify/[id] page. */
export function VerifyCertificateForm({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [id, setId] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = id.trim();
    if (value) router.push(`/certificate/verify/${encodeURIComponent(value)}`);
  };

  return (
    <form onSubmit={submit} className={cn("max-w-md", className)}>
      <label htmlFor="verify-cert-id" className="text-[13px] font-medium text-foreground">
        Verify a certificate
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="verify-cert-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Certificate ID, e.g. AFE-2026-…"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className="min-w-0 flex-1 h-11 rounded-full border border-input bg-card px-4 text-[14px] text-foreground placeholder:text-muted-foreground font-mono"
        />
        <button
          type="submit"
          disabled={!id.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 h-11 px-5 rounded-full border border-border bg-card text-[14px] font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-violet-600" aria-hidden /> Verify
        </button>
      </div>
    </form>
  );
}
