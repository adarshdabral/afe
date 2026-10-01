"use client";

import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import type { Credentials } from "@/lib/api/teachers";

// Shows the one-time plaintext credentials returned by create / reset-password.
// The temporary password is never retrievable again, so the admin must copy it now.
export function CredentialsCard({ credentials }: { credentials: Credentials }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-foreground">Temporary credentials</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Share these with the teacher. The password is shown once and cannot be retrieved later —
        copy it now.
      </p>
      <CopyRow label="Login (email)" value={credentials.loginId} />
      <CopyRow label="Temporary password" value={credentials.temporaryPassword} mono />
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — value is still visible to copy manually */
    }
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/20"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
