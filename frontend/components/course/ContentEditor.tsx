"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AudioLines,
  Captions,
  FileCheck2,
  FileText,
  Film,
  Presentation,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichContentEditor } from "./RichContentEditor";
import { NarrationPlayer } from "@/components/learn/NarrationPlayer";
import {
  AUDIO_UPLOAD_ACCEPT,
  DEFAULT_LIMITS,
  generateNarration,
  getUploadConfig,
  resolveUploadUrl,
  SUBTITLE_UPLOAD_ACCEPT,
  UPLOAD_ACCEPT,
  uploadErrorMessage,
  uploadMedia,
  uploadSubtitles,
  VIDEO_UPLOAD_ACCEPT,
  type UploadConfig,
  type UploadKind,
} from "@/lib/api/uploads";
import type { ContentType } from "@/lib/api/courses";

const inputClass = "mt-1.5 rounded-xl h-10";

/** The learning-content parts edited here (shared by Topics and Course Sections). */
export interface ContentValue {
  contentType?: ContentType;
  content?: string;
  audioUrl?: string;
  documentUrl?: string;
  videoUrl?: string;
  subtitleUrl?: string;
}

type MediaField = "videoUrl" | "subtitleUrl" | "audioUrl" | "documentUrl";
const FIELD_KIND: Record<MediaField, UploadKind> = {
  videoUrl: "video",
  subtitleUrl: "subtitle",
  audioUrl: "audio",
  documentUrl: "document",
};

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Validate the content parts; returns field → message (empty when valid). */
export function validateContent(v: ContentValue): Record<string, string> {
  const er: Record<string, string> = {};
  // Media fields: a full URL or an uploaded root-relative path (/api/uploads/…).
  for (const f of ["videoUrl", "subtitleUrl", "audioUrl", "documentUrl"] as MediaField[]) {
    const val = v[f];
    if (val && !/^(https?:\/\/|\/)\S+$/.test(val)) er[f] = "Upload a file or enter a valid URL";
  }
  if (v.subtitleUrl && !v.videoUrl) er.subtitleUrl = "Add a video for these subtitles";
  if (v.contentType === "presentation" && !v.documentUrl) er.documentUrl = "Upload a presentation or paste a URL";
  return er;
}

/**
 * Editor for the shared content system — Text, Audio (upload or generate from the
 * text), PDF/PowerPoint, and Video with subtitles (SRT/VTT). Used by Topics and by
 * the course sections (Introduction, Overview, Meet the Instructor). Controlled:
 * `onChange` receives only the changed fields (merge them into your state).
 * Files go to Cloudflare R2 (or the backend's disk) via lib/api/uploads.
 */
export function ContentEditor({
  value,
  onChange,
  errors = {},
  onBusyChange,
}: {
  value: ContentValue;
  onChange: (patch: Partial<ContentValue>) => void;
  errors?: Record<string, string>;
  /** Uploads / narration in progress — disable saving meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const form = value;
  const errs = errors;
  const [progress, setProgress] = useState<Partial<Record<MediaField, number>>>({});
  const [narrating, setNarrating] = useState(false);
  const [config, setConfig] = useState<UploadConfig | null>(null);
  const [voice, setVoice] = useState<string>("");

  useEffect(() => {
    getUploadConfig()
      .then((c) => {
        setConfig(c);
        setVoice(c.ttsDefaultVoice ?? "");
      })
      .catch(() => setConfig(null));
  }, []);

  const set = <K extends keyof ContentValue>(k: K, v: ContentValue[K]) => onChange({ [k]: v } as Partial<ContentValue>);

  const busy = Object.keys(progress).length > 0 || narrating;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  const limit = (kind: UploadKind) => config?.limits[kind] ?? DEFAULT_LIMITS[kind];

  async function upload(field: MediaField, file: File) {
    const kind = FIELD_KIND[field];
    if (file.size > limit(kind)) {
      toast.error(`File is too large (max ${mb(limit(kind))}).`);
      return;
    }
    setProgress((p) => ({ ...p, [field]: 0 }));
    try {
      const onProgress = (pct: number) => setProgress((p) => ({ ...p, [field]: pct }));
      const res = kind === "subtitle" ? await uploadSubtitles(file, onProgress) : await uploadMedia(kind, file, onProgress);
      set(field, res.url);
      toast.success(`Uploaded ${file.name}`);
    } catch (err) {
      toast.error(uploadErrorMessage(err));
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[field];
        return next;
      });
    }
  }

  async function narrate() {
    if (!form.content?.trim()) {
      toast.error("Write the text first — the audio is generated from it.");
      return;
    }
    if (form.audioUrl && !confirm("Replace the current audio with narration generated from the text?")) return;
    setNarrating(true);
    try {
      const res = await generateNarration(form.content, voice || undefined);
      set("audioUrl", res.url);
      toast.success(`Narration generated (${res.characters.toLocaleString()} characters).`);
    } catch (err) {
      toast.error(uploadErrorMessage(err, "Could not generate audio"));
    } finally {
      setNarrating(false);
    }
  }

  const isYouTube = /youtube\.com|youtu\.be|vimeo\.com/.test(form.videoUrl ?? "");

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-muted-foreground">
        Combine any of the parts below. Files are stored in{" "}
        {config?.storage === "r2" ? "Cloudflare R2" : "the backend's upload folder"}.
      </p>

      {/* Text */}
      <Section icon={FileText} title="Text">
        <RichContentEditor
          value={form.content ?? ""}
          onChange={(v) => set("content", v)}
          placeholder="Write the content in markdown…"
        />
      </Section>

      {/* Audio */}
      <Section icon={AudioLines} title="Audio narration">
        <div className="flex flex-wrap items-center gap-2">
          <UploadButton
            label={form.audioUrl ? "Replace audio" : "Upload audio"}
            accept={AUDIO_UPLOAD_ACCEPT}
            progress={progress.audioUrl}
            disabled={busy}
            onFile={(f) => upload("audioUrl", f)}
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-10"
            disabled={busy || config?.tts === false}
            onClick={narrate}
            title={config?.tts === false ? "Text-to-speech isn't configured on the backend" : undefined}
          >
            {narrating ? (
              <span className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {narrating ? "Generating audio…" : "Generate from text"}
          </Button>
          {config?.tts && (config.ttsVoices?.length ?? 0) > 0 && (
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={busy}
              aria-label="Narration voice"
              className="h-10 rounded-xl border border-input bg-card px-2.5 text-sm text-foreground"
            >
              {(["male", "female"] as const).map((g) => (
                <optgroup key={g} label={g === "male" ? "Male voices" : "Female voices"}>
                  {config.ttsVoices
                    .filter((v) => v.gender === g)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
          {config?.tts === false && (
            <span className="text-[11px] text-muted-foreground">Text-to-speech isn&apos;t configured.</span>
          )}
        </div>
        <UrlField
          value={form.audioUrl ?? ""}
          onChange={(v) => set("audioUrl", v)}
          placeholder="…or paste an audio URL"
          error={errs.audioUrl}
          hint={`MP3, M4A, AAC, WAV or OGG — up to ${mb(limit("audio"))}. Generated narration reads the text above; learners hear it at 0.9× by default and can change the speed.`}
        />
        {form.audioUrl && (
          <Preview label="Audio" onRemove={() => set("audioUrl", "")}>
            <NarrationPlayer src={resolveUploadUrl(form.audioUrl)} />
          </Preview>
        )}
      </Section>

      {/* Document */}
      <Section icon={Presentation} title="PDF or PowerPoint">
        <UploadButton
          label={form.documentUrl ? "Replace file" : "Upload PDF / PPT"}
          accept={UPLOAD_ACCEPT}
          progress={progress.documentUrl}
          disabled={busy}
          onFile={(f) => upload("documentUrl", f)}
        />
        <UrlField
          value={form.documentUrl ?? ""}
          onChange={(v) => set("documentUrl", v)}
          placeholder="…or paste a PDF / slides URL"
          error={errs.documentUrl}
          hint={`PDF, PPT, PPTX or an image — up to ${mb(limit("document"))}.`}
        />
        {form.documentUrl && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-600">
            <FileCheck2 className="w-4 h-4" /> Attached ·{" "}
            <a href={resolveUploadUrl(form.documentUrl)} target="_blank" rel="noreferrer" className="underline">
              open
            </a>
            <button type="button" onClick={() => set("documentUrl", "")} className="ml-2 text-muted-foreground hover:text-foreground">
              remove
            </button>
          </p>
        )}
      </Section>

      {/* Video + subtitles */}
      <Section icon={Film} title="Video">
        <UploadButton
          label={form.videoUrl ? "Replace video" : "Upload video"}
          accept={VIDEO_UPLOAD_ACCEPT}
          progress={progress.videoUrl}
          disabled={busy}
          onFile={(f) => upload("videoUrl", f)}
        />
        <UrlField
          value={form.videoUrl ?? ""}
          onChange={(v) => set("videoUrl", v)}
          placeholder="…or paste a YouTube, Vimeo or video file URL"
          error={errs.videoUrl}
          hint={`MP4 (recommended), WebM or MOV — up to ${mb(limit("video"))}.`}
        />

        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Captions className="w-4 h-4 text-violet-600" /> Subtitles
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <UploadButton
              label={form.subtitleUrl ? "Replace subtitles" : "Add SRT / VTT file"}
              accept={SUBTITLE_UPLOAD_ACCEPT}
              progress={progress.subtitleUrl}
              disabled={busy || !form.videoUrl}
              onFile={(f) => upload("subtitleUrl", f)}
            />
            {form.subtitleUrl && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                <FileCheck2 className="w-4 h-4" /> Subtitles attached
                <button type="button" onClick={() => set("subtitleUrl", "")} className="ml-1 text-muted-foreground hover:text-foreground">
                  remove
                </button>
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {!form.videoUrl
              ? "Add a video first."
              : isYouTube
                ? "YouTube/Vimeo show their own captions — subtitle files apply to uploaded or direct video files."
                : "SRT files are converted to WebVTT automatically."}
          </p>
          {errs.subtitleUrl && <p className="text-xs text-red-500 mt-1">{errs.subtitleUrl}</p>}
        </div>

        {form.videoUrl && !isYouTube && (
          <Preview label="Preview" onRemove={() => set("videoUrl", "")}>
            <video
              key={`${form.videoUrl}|${form.subtitleUrl}`}
              src={resolveUploadUrl(form.videoUrl)}
              controls
              preload="metadata"
              playsInline
              crossOrigin={form.subtitleUrl ? "anonymous" : undefined}
              className="w-full max-h-64 bg-black"
            >
              {form.subtitleUrl && (
                <track kind="subtitles" src={resolveUploadUrl(form.subtitleUrl)} srcLang="en" label="English" default />
              )}
            </video>
          </Preview>
        )}
      </Section>

    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-border p-4">
      <legend className="px-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="w-4 h-4 text-violet-600" /> {title}
      </legend>
      {children}
    </fieldset>
  );
}

function UploadButton({
  label,
  accept,
  progress,
  disabled,
  onFile,
}: {
  label: string;
  accept: string;
  progress?: number;
  disabled?: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const uploading = progress !== undefined;
  return (
    <div className="inline-flex flex-col">
      <label
        className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm transition-colors ${
          uploading || disabled
            ? "opacity-60 cursor-not-allowed border-input"
            : "cursor-pointer border-input bg-secondary/60 hover:bg-secondary text-foreground"
        }`}
      >
        {uploading ? (
          <span className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {uploading ? `Uploading… ${progress}%` : label}
        <input
          ref={ref}
          type="file"
          accept={accept}
          disabled={uploading || disabled}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // allow re-picking the same file
            if (f) onFile(f);
          }}
        />
      </label>
      {uploading && (
        <div
          className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-violet-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function UrlField({
  value,
  onChange,
  placeholder,
  error,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  hint: string;
}) {
  return (
    <div className="mt-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${error ? "ring-2 ring-red-500" : ""}`}
      />
      <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Preview({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-secondary text-xs text-foreground">
        <span>{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" /> Remove
        </button>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}
