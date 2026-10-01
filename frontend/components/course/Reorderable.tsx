"use client";

import { useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

/** Move item from index `from` to index `to`, returning a new array. */
export function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Controlled drag-and-drop list using native HTML5 DnD (no external dependency).
// The parent owns the ordered array and reorders it in `onMove`; persistence is
// explicit (a Save button in the parent) — this component never auto-saves.
export function Reorderable<T extends { id: string }>({
  items,
  onMove,
  renderItem,
  disabled,
}: {
  items: T[];
  onMove: (from: number, to: number) => void;
  renderItem: (item: T) => ReactNode;
  disabled?: boolean;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li
          key={item.id}
          draggable={!disabled}
          onDragStart={() => setDragIdx(idx)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIdx(idx);
          }}
          onDrop={() => {
            if (dragIdx !== null && dragIdx !== idx) onMove(dragIdx, idx);
            setDragIdx(null);
            setOverIdx(null);
          }}
          onDragEnd={() => {
            setDragIdx(null);
            setOverIdx(null);
          }}
          className={`flex items-stretch gap-2 rounded-xl border bg-card transition-colors ${
            overIdx === idx && dragIdx !== null && dragIdx !== idx
              ? "border-violet-500 ring-2 ring-violet-500/20"
              : "border-gray-200 dark:border-gray-700"
          } ${dragIdx === idx ? "opacity-50" : ""}`}
        >
          {!disabled && (
            <span className="flex items-center px-1 text-muted-foreground cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">{renderItem(item)}</div>
        </li>
      ))}
    </ul>
  );
}
