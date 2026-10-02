"use client";

import { FileText, Download, Presentation, Maximize2, AudioLines } from "lucide-react";
import { MarkdownView } from "./MarkdownView";
import type { ContentFields } from "@/lib/api/courses";
import { resolveUploadUrl } from "@/lib/api/uploads";
import { NarrationPlayer } from "./NarrationPlayer";

// Renders MULTI-PART learning content — a Topic or a course section — showing every
// part it has, in this order:
//   video (with WebVTT subtitles) → audio narration → text → PDF/PPT (or image).
// Documents always offer Open-in-new-tab + Download so the file is reachable even
// where inline embedding is limited (e.g. mobile Safari). `contentType` only picks
// the empty-state message when there are no parts yet.
export function ContentRenderer({ item }: { item: ContentFields & { title: string } }) {
  const video = resolveUploadUrl(item.videoUrl ?? "");
  const subtitles = resolveUploadUrl(item.subtitleUrl ?? "");
  const audio = resolveUploadUrl(item.audioUrl ?? "");
  const doc = resolveUploadUrl(item.documentUrl ?? "");
  const text = item.content?.trim() ?? "";
  const isImageContent = item.contentType === "infographic";

  if (!video && !audio && !text && !doc) {
    return <Empty label={EMPTY_LABEL[item.contentType] ?? "No content has been added here yet."} />;
  }

  return (
    <div className="space-y-8">
      {video && <VideoBlock url={video} subtitles={subtitles} title={item.title} />}
      {audio && <AudioBlock url={audio} />}
      {text && (
        <div className="prose-none">
          <MarkdownView markdown={item.content} />
        </div>
      )}
      {doc &&
        (isImageContent || isImage(doc) ? (
          <ImageBlock url={doc} alt={item.title} />
        ) : (
          <DocumentViewer url={doc} title={item.title} kind={isDeck(doc) || item.contentType === "presentation" ? "presentation" : "pdf"} />
        ))}
    </div>
  );
}

const EMPTY_LABEL: Partial<Record<ContentFields["contentType"], string>> = {
  video: "No video has been added yet.",
  pdf: "No document has been added yet.",
  presentation: "No presentation has been added yet.",
  infographic: "No image has been added yet.",
};

const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
const isDeck = (url: string) => /\.(pptx?|ppsx?)(\?|$)/i.test(url);
const isEmbeddable = (url: string) => /youtube\.com|youtu\.be|vimeo\.com/.test(url);

function VideoBlock({ url, subtitles, title }: { url: string; subtitles: string; title: string }) {
  if (isEmbeddable(url)) {
    const embed = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
    return (
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-soft">
        <iframe src={embed} className="w-full h-full" allowFullScreen title={title || "Video"} />
      </div>
    );
  }
  return (
    // Uploaded (R2 or /api/uploads) or direct file URL; storage serves Range requests so
    // seeking works. Cross-origin captions need CORS, hence crossOrigin when subtitled.
    <video
      controls
      src={url}
      preload="metadata"
      playsInline
      controlsList="nodownload"
      crossOrigin={subtitles ? "anonymous" : undefined}
      className="w-full aspect-video rounded-2xl bg-black shadow-soft"
    >
      {subtitles && <track kind="subtitles" src={subtitles} srcLang="en" label="English" default />}
      Your browser does not support video.
    </video>
  );
}

function AudioBlock({ url }: { url: string }) {
  return (
    <figure className="rounded-2xl border border-border bg-card shadow-soft p-4">
      <figcaption className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-3">
        <AudioLines className="w-4 h-4 text-violet-600" /> Listen
      </figcaption>
      <NarrationPlayer src={url} />
    </figure>
  );
}

// PDFs render inline with <object>; PowerPoint decks hosted at a public https URL
// (Cloudflare R2) render via Microsoft's Office web viewer. Open/Download always work.
function DocumentViewer({
  url,
  title,
  kind,
}: {
  url: string;
  title: string;
  kind: "pdf" | "presentation";
}) {
  const Icon = kind === "presentation" ? Presentation : FileText;
  const label = kind === "presentation" ? "Presentation" : "Document";
  const officeEmbed =
    isDeck(url) && /^https:\/\//.test(url)
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
      : null;

  return (
    <figure className="rounded-2xl overflow-hidden border border-border shadow-soft bg-card">
      <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-secondary/50">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground min-w-0">
          <Icon className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="truncate">{title || label}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] text-foreground hover:bg-secondary transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Open
          </a>
          <a
            href={url}
            download
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] bg-violet-600 hover:bg-violet-700 text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </figcaption>

      {officeEmbed ? (
        <div className="aspect-video bg-muted">
          <iframe src={officeEmbed} className="w-full h-full" title={title || label} />
        </div>
      ) : isDeck(url) ? (
        <Fallback url={url} message="Slides open in PowerPoint or your browser's viewer." />
      ) : (
        <div className={kind === "presentation" ? "aspect-video bg-muted" : "h-[76vh] bg-muted"}>
          <object data={url} type="application/pdf" className="w-full h-full">
            <Fallback url={url} message="This file can't be previewed inline on this device." />
          </object>
        </div>
      )}
    </figure>
  );
}

function Fallback({ url, message }: { url: string; message: string }) {
  return (
    <div className="h-full min-h-48 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <FileText className="w-10 h-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm bg-violet-600 hover:bg-violet-700 text-white transition-colors"
      >
        <Maximize2 className="w-4 h-4" /> Open document
      </a>
    </div>
  );
}

function ImageBlock({ url, alt }: { url: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-full rounded-2xl border border-border shadow-soft" />;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
      <FileText className="w-8 h-8 mx-auto mb-2" />
      {label}
    </div>
  );
}
