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
  relatedOptions = [],
}: {
  topic?: Topic;
  onSave: (input: CreateTopicInput) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
  /** Other topics a discussion can be about ("Related topic"). */
  relatedOptions?: { id: string; title: string }[];
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
    allowDownload: topic?.allowDownload ?? true,
  });
  const [discussion, setDiscussion] = useState({
    prompt: topic?.discussion?.prompt ?? "",
    instructions: topic?.discussion?.instructions ?? "",
    questions: (topic?.discussion?.questions ?? []).join("\n"),
    relatedTopicId: topic?.discussion?.relatedTopicId ?? "",
    required: topic?.discussion?.required ?? false,
  });
  const isDiscussion = form.contentType === "discussion";
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CreateTopicInput>(k: K, v: CreateTopicInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A discussion's substance is its prompt; other formats need their content parts.
    const er = isDiscussion ? {} : validateContent(form);
    if (isDiscussion && !discussion.prompt.trim()) (er as Record<string, string>).prompt = "Required";
    if (!form.title.trim()) er.title = "Required";
    if (busy) er.title = er.title ?? "Wait for uploads to finish";
    setErrs(er);
    if (Object.keys(er).length) return;
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        ...(isDiscussion
          ? {
              discussion: {
                prompt: discussion.prompt.trim(),
                instructions: discussion.instructions.trim(),
                questions: discussion.questions.split("\n").map((q) => q.trim()).filter(Boolean),
                relatedTopicId: discussion.relatedTopicId || null,
                required: discussion.required,
              },
            }
          : {}),
      });
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

      {isDiscussion && (
        <fieldset className="rounded-2xl border border-violet-600/25 bg-violet-600/[0.03] p-4 space-y-3">
          <legend className="px-1 text-sm font-semibold text-foreground">Discussion</legend>
          <p className="text-[12px] text-muted-foreground -mt-1">
            Students discuss in a forum thread linked to this topic (created when you save). Add optional reading/media below.
          </p>
          <div>
            <Label>Discussion prompt</Label>
            <textarea
              value={discussion.prompt}
              onChange={(e) => setDiscussion((d) => ({ ...d, prompt: e.target.value }))}
              rows={2}
              placeholder="e.g. Where have you noticed AI in your daily life this week?"
              className={`mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground ${errs.prompt ? "ring-2 ring-red-500" : ""}`}
            />
            {errs.prompt && <p className="text-xs text-red-500 mt-1">{errs.prompt}</p>}
          </div>
          <div>
            <Label>Instructions</Label>
            <textarea
              value={discussion.instructions}
              onChange={(e) => setDiscussion((d) => ({ ...d, instructions: e.target.value }))}
              rows={2}
              placeholder="How to take part (length, tone, replying to classmates…)"
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <Label>Discussion questions (optional, one per line)</Label>
            <textarea
              value={discussion.questions}
              onChange={(e) => setDiscussion((d) => ({ ...d, questions: e.target.value }))}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Related topic (optional)</Label>
              <select
                value={discussion.relatedTopicId}
                onChange={(e) => setDiscussion((d) => ({ ...d, relatedTopicId: e.target.value }))}
                className={selectClass}
              >
                <option value="">None</option>
                {relatedOptions.filter((o) => o.id !== topic?.id).map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 mt-7 text-sm text-foreground">
              <input
                type="checkbox"
                checked={discussion.required}
                onChange={(e) => setDiscussion((d) => ({ ...d, required: e.target.checked }))}
                className="h-4 w-4"
              />
              Students must post to complete it
            </label>
          </div>
        </fieldset>
      )}

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
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={form.allowDownload ?? true} onChange={(e) => set("allowDownload", e.target.checked)} className="h-4 w-4" />
          Download allowed — students can download this topic&apos;s text and uploaded files
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
