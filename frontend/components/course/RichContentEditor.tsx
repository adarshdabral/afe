"use client";

import { useState } from "react";
import { Bold, Italic, Heading2, List, Link2, Eye, Pencil } from "lucide-react";

// Rich content editor — Markdown fallback (the spec's fallback; TipTap is the
// preferred future upgrade). Stores a serialized markdown string in MongoDB. Ships
// a small formatting toolbar and a live preview toggle. No new dependencies.
export function RichContentEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [preview, setPreview] = useState(false);

  const wrap = (before: string, after = before) => {
    onChange(`${value}${value && !value.endsWith("\n") ? "" : ""}${before}text${after}`);
  };
  const prefixLine = (prefix: string) => {
    onChange(`${value}${value && !value.endsWith("\n") ? "\n" : ""}${prefix}`);
  };

  return (
    <div className="rounded-xl border border-input overflow-hidden">
      <div className="flex items-center gap-1 border-b border-input bg-muted/40 px-2 py-1">
        <ToolbarButton label="Bold" onClick={() => wrap("**")}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => wrap("_")}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading" onClick={() => prefixLine("## ")}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton label="List item" onClick={() => prefixLine("- ")}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={() => onChange(`${value}[text](https://)`)}>
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        <div className="flex-1" />
        <ToolbarButton label={preview ? "Edit" : "Preview"} onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </ToolbarButton>
      </div>
      {preview ? (
        <div className="min-h-[180px] px-3 py-2 text-sm">
          <MarkdownPreview markdown={value} />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Write markdown…"}
          rows={10}
          className="w-full resize-y px-3 py-2 text-sm font-mono bg-card text-foreground outline-none"
        />
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-foreground"
    >
      {children}
    </button>
  );
}

// Minimal, dependency-free markdown renderer (headings, bold/italic, lists, links).
// Good enough for an author-facing preview; the stored value is the raw markdown.
function MarkdownPreview({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return <p className="text-muted-foreground">Nothing to preview.</p>;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a class="text-violet-600 underline" href="$2">$1</a>',
      );

  const lines = markdown.split("\n");
  const html: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^-\s+/.test(line)) {
      if (!inList) {
        html.push("<ul class='list-disc pl-5'>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^-\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (/^##\s+/.test(line)) html.push(`<h3 class='font-semibold text-base mt-2'>${inline(line.replace(/^##\s+/, ""))}</h3>`);
    else if (/^#\s+/.test(line)) html.push(`<h2 class='font-bold text-lg mt-2'>${inline(line.replace(/^#\s+/, ""))}</h2>`);
    else if (line === "") html.push("<div class='h-2'></div>");
    else html.push(`<p>${inline(line)}</p>`);
  }
  if (inList) html.push("</ul>");
  return <div className="space-y-1" dangerouslySetInnerHTML={{ __html: html.join("") }} />;
}
