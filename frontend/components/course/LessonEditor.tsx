"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileCheck2, Film, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichContentEditor } from "./RichContentEditor";
import {
  resolveUploadUrl,
  uploadErrorMessage,
  uploadFile,
  uploadVideo,
  UPLOAD_ACCEPT,
  VIDEO_UPLOAD_ACCEPT,
  VIDEO_UPLOAD_MAX_BYTES,
} from "@/lib/api/uploads";
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
// rich types get the RichContentEditor; video gets an upload-or-URL input; pdf/
// presentation/infographic get an upload-or-URL input. This
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
  const [uploading, setUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);

  const set = <K extends keyof CreateLessonInput>(k: K, v: CreateLessonInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isRich = RICH_CONTENT_TYPES.includes(form.contentType);
  const isVideo = form.contentType === "video";
  const isPresentation = form.contentType === "presentation";
  const isDoc = isPresentation || form.contentType === "pdf" || form.contentType === "infographic";
  const uploaded = (form.documentUrl ?? "").startsWith("/api/uploads/");
  const videoUploaded = (form.videoUrl ?? "").startsWith("/api/uploads/");

  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      toast.error(`Video is too large (max ${VIDEO_UPLOAD_MAX_BYTES / (1024 * 1024)} MB).`);
      return;
    }
    setVideoProgress(0);
    try {
      const res = await uploadVideo(file, setVideoProgress);
      set("videoUrl", res.url);
      setErrs((prev) => ({ ...prev, videoUrl: "" }));
      toast.success(`Uploaded ${res.originalName}`);
    } catch (err) {
      toast.error(uploadErrorMessage(err, "Video upload failed"));
    } finally {
      setVideoProgress(null);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      set("documentUrl", res.url);
      setErrs((prev) => ({ ...prev, documentUrl: "" }));
      toast.success(`Uploaded ${res.originalName}`);
    } catch (err) {
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.title.trim()) er.title = "Required";
    // Accept a full URL (YouTube/Vimeo/file) or an uploaded relative path (/api/uploads/…).
    if (isVideo && form.videoUrl && !/^(https?:\/\/|\/)\S+$/.test(form.videoUrl))
      er.videoUrl = "Upload a video or enter a valid URL";
    if (videoProgress !== null) er.videoUrl = "Wait for the video upload to finish";
    // Accept either a full URL or an uploaded relative path (/api/uploads/…).
    if (isDoc && form.documentUrl && !/^(https?:\/\/|\/)\S+$/.test(form.documentUrl))
      er.documentUrl = "Upload a file or enter a valid URL";
    if (isPresentation && !form.documentUrl) er.documentUrl = "Upload a presentation or paste a URL";
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
          <Label>Video</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <label
              className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm transition-colors shrink-0 ${
                videoProgress !== null
                  ? "opacity-60 cursor-wait border-input"
                  : "cursor-pointer border-input bg-secondary/60 hover:bg-secondary text-foreground"
              }`}
            >
              {videoProgress !== null ? (
                <span className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {videoProgress !== null
                ? `Uploading… ${videoProgress}%`
                : videoUploaded
                  ? "Replace video"
                  : "Upload video"}
              <input
                type="file"
                accept={VIDEO_UPLOAD_ACCEPT}
                onChange={handleVideo}
                disabled={videoProgress !== null}
                className="sr-only"
              />
            </label>
            {videoUploaded && videoProgress === null && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 min-w-0">
                <FileCheck2 className="w-4 h-4 shrink-0" /> Video uploaded
              </span>
            )}
          </div>
          {videoProgress !== null && (
            <div
              className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={videoProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Video upload progress"
            >
              <div className="h-full bg-violet-600 transition-[width]" style={{ width: `${videoProgress}%` }} />
            </div>
          )}
          <div className="mt-2">
            <Input
              value={form.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="…or paste a YouTube, Vimeo or video file URL"
              className={`${inputClass} ${errs.videoUrl ? "ring-2 ring-red-500" : ""}`}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              MP4 (recommended), WebM or MOV — up to {VIDEO_UPLOAD_MAX_BYTES / (1024 * 1024)} MB.
            </p>
          </div>
          {errs.videoUrl && <p className="text-xs text-red-500 mt-1">{errs.videoUrl}</p>}

          {videoUploaded && videoProgress === null && (
            <div className="mt-3 rounded-xl border border-border overflow-hidden bg-black">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-secondary text-xs text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" /> Preview
                </span>
                <button
                  type="button"
                  onClick={() => set("videoUrl", "")}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
              <video
                src={resolveUploadUrl(form.videoUrl ?? "")}
                controls
                preload="metadata"
                playsInline
                className="w-full max-h-64"
              />
            </div>
          )}
        </div>
      )}

      {isDoc && (
        <div>
          <Label>
            {isPresentation ? "Presentation file" : form.contentType === "pdf" ? "Document" : "Image"}
          </Label>
          <div className="mt-1.5 flex items-center gap-3">
            <label
              className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm cursor-pointer transition-colors shrink-0 ${
                uploading
                  ? "opacity-60 cursor-wait border-input"
                  : "border-input bg-secondary/60 hover:bg-secondary text-foreground"
              }`}
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "Uploading…" : uploaded ? "Replace file" : "Upload file"}
              <input
                type="file"
                accept={UPLOAD_ACCEPT}
                onChange={handleFile}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            {uploaded && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 min-w-0">
                <FileCheck2 className="w-4 h-4 shrink-0" /> File uploaded
              </span>
            )}
          </div>
          <div className="mt-2">
            <Input
              value={form.documentUrl}
              onChange={(e) => set("documentUrl", e.target.value)}
              placeholder={isPresentation ? "…or paste a PDF/slides URL" : "…or paste a URL"}
              className={`${inputClass} ${errs.documentUrl ? "ring-2 ring-red-500" : ""}`}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              PDF, PowerPoint, or image — up to 25 MB.
            </p>
          </div>
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
