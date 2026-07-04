"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichContentEditor } from "./RichContentEditor";
import {
  LESSON_CONTENT_TYPES,
  RICH_CONTENT_TYPES,
  type CreateLessonInput,
  type Lesson,
  type LessonContentType,
} from "@/lib/api/courses";

const inputClass = "mt-1.5 rounded-xl h-10";
const selectClass =
  "mt-1.5 w-full h-10 px-3 rounded-xl border border-input bg-card text-sm text-foreground";

// Explicit-save lesson editor (create or edit). Fields shown adapt to contentType:
// rich types get the RichContentEditor; video/pdf/infographic get URL inputs. This
// component takes an onSave callback — it never calls axios directly.
export function LessonEditor({
  lesson,
  onSave,
  onCancel,
  saving,
}: {
  lesson?: Lesson;
  onSave: (input: CreateLessonInput) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<CreateLessonInput>({
    title: lesson?.title ?? "",
    contentType: lesson?.contentType ?? "rich_text",
    description: lesson?.description ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    documentUrl: lesson?.documentUrl ?? "",
    content: lesson?.content ?? "",
    estimatedDurationMinutes: lesson?.estimatedDurationMinutes ?? 0,
    isPreview: lesson?.isPreview ?? false,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  const set = <K extends keyof CreateLessonInput>(k: K, v: CreateLessonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isRich = RICH_CONTENT_TYPES.includes(form.contentType);
  const isVideo = form.contentType === "video";
  const isDoc = form.contentType === "pdf" || form.contentType === "infographic";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.title.trim()) er.title = "Required";
    if (isVideo && form.videoUrl && !/^https?:\/\/\S+$/.test(form.videoUrl))
      er.videoUrl = "Enter a valid URL";
    if (isDoc && form.documentUrl && !/^https?:\/\/\S+$/.test(form.documentUrl))
      er.documentUrl = "Enter a valid URL";
    setErrs(er);
    if (Object.keys(er).length) return;
    try {
      await onSave({ ...form, title: form.title.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save lesson");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className={`${inputClass} ${errs.title ? "ring-2 ring-red-500" : ""}`}
          />
          {errs.title && <p className="text-xs text-red-500 mt-1">{errs.title}</p>}
        </div>
        <div>
          <Label>Content type</Label>
          <select
            value={form.contentType}
            onChange={(e) => set("contentType", e.target.value as LessonContentType)}
            className={selectClass}
          >
            {LESSON_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
          placeholder="Short summary"
        />
      </div>

      {isVideo && (
        <div>
          <Label>Video URL</Label>
          <Input
            value={form.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            placeholder="https://…"
            className={`${inputClass} ${errs.videoUrl ? "ring-2 ring-red-500" : ""}`}
          />
          {errs.videoUrl && <p className="text-xs text-red-500 mt-1">{errs.videoUrl}</p>}
        </div>
      )}

      {isDoc && (
        <div>
          <Label>Document URL</Label>
          <Input
            value={form.documentUrl}
            onChange={(e) => set("documentUrl", e.target.value)}
            placeholder="https://…"
            className={`${inputClass} ${errs.documentUrl ? "ring-2 ring-red-500" : ""}`}
          />
          {errs.documentUrl && <p className="text-xs text-red-500 mt-1">{errs.documentUrl}</p>}
        </div>
      )}

      {isRich && (
        <div>
          <Label>Content</Label>
          <div className="mt-1.5">
            <RichContentEditor
              value={form.content ?? ""}
              onChange={(v) => set("content", v)}
              placeholder="Write the lesson content in markdown…"
            />
          </div>
        </div>
      )}

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
          <input
            type="checkbox"
            checked={form.isPreview ?? false}
            onChange={(e) => set("isPreview", e.target.checked)}
            className="h-4 w-4"
          />
          Free preview lesson
        </label>
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving}
          className="rounded-xl h-10 bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving ? "Saving…" : "Save lesson"}
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
