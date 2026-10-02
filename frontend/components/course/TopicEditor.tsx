"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentEditor, validateContent } from "./ContentEditor";
import { CONTENT_TYPES, type ContentType, type CreateTopicInput, type Topic } from "@/lib/api/courses";

const inputClass = "mt-1.5 rounded-xl h-10";
const selectClass = "mt-1.5 w-full h-10 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

// Explicit-save TOPIC editor (create or edit). A topic is the learning unit inside a
// lesson: title, primary format, description, its content (via ContentEditor), an
// estimated duration and a preview flag. Takes an onSave callback — it never calls
// the topic API directly.
export function TopicEditor({
  topic,
  onSave,
  onCancel,
  saving,
}: {
  topic?: Topic;
  onSave: (input: CreateTopicInput) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<CreateTopicInput>({
    title: topic?.title ?? "",
    contentType: topic?.contentType ?? "rich_text",
    description: topic?.description ?? "",
    content: topic?.content ?? "",
    audioUrl: topic?.audioUrl ?? "",
    documentUrl: topic?.documentUrl ?? "",
    videoUrl: topic?.videoUrl ?? "",
    subtitleUrl: topic?.subtitleUrl ?? "",
    estimatedDurationMinutes: topic?.estimatedDurationMinutes ?? 0,
    isPreview: topic?.isPreview ?? false,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CreateTopicInput>(k: K, v: CreateTopicInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er = validateContent(form);
    if (!form.title.trim()) er.title = "Required";
    if (busy) er.title = er.title ?? "Wait for uploads to finish";
    setErrs(er);
    if (Object.keys(er).length) return;
    try {
      await onSave({ ...form, title: form.title.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save topic");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Topic title</Label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. What is Artificial Intelligence?"
            className={`${inputClass} ${errs.title ? "ring-2 ring-red-500" : ""}`}
          />
          {errs.title && <p className="text-xs text-red-500 mt-1">{errs.title}</p>}
        </div>
        <div>
          <Label>Primary format</Label>
          <select value={form.contentType} onChange={(e) => set("contentType", e.target.value as ContentType)} className={selectClass}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} placeholder="Short summary" />
      </div>

      <ContentEditor
        value={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        errors={errs}
        onBusyChange={setBusy}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Estimated duration (min)</Label>
          <Input
            type="number"
            min={0}
            value={form.estimatedDurationMinutes ?? 0}
            onChange={(e) => set("estimatedDurationMinutes", Number(e.target.value) || 0)}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 mt-7 text-sm text-foreground">
          <input type="checkbox" checked={form.isPreview ?? false} onChange={(e) => set("isPreview", e.target.checked)} className="h-4 w-4" />
          Free preview topic
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || busy} className="rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white">
          {saving ? "Saving…" : busy ? "Uploading…" : "Save topic"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-xl h-10" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
