"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const MAX = 20;

/** Editable list of a module's learning objectives (one outcome per line). */
export function ObjectivesEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const items = value.length ? value : [""];
  const update = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {items.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 text-right text-[12px] tabular-nums text-muted-foreground">{i + 1}.</span>
          <Input
            value={o}
            onChange={(e) => update(i, e.target.value)}
            placeholder={i === 0 ? "e.g. Explain the difference between narrow and general AI" : "Another objective"}
            maxLength={300}
            className="rounded-xl h-10"
            aria-label={`Learning objective ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={items.length === 1 && !o}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-30"
            aria-label={`Remove objective ${i + 1}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length < MAX && (
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="ml-7 inline-flex items-center gap-1 text-[13px] text-violet-600 hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Add objective
        </button>
      )}
    </div>
  );
}
