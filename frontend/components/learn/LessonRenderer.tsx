"use client";

import { FileText, Download, Presentation, Maximize2 } from "lucide-react";
import { MarkdownView } from "./MarkdownView";
import type { Lesson } from "@/lib/api/courses";
import { resolveUploadUrl } from "@/lib/api/uploads";

// Renders a lesson by contentType:
//  video → embedded player · pdf → document viewer · presentation → slide viewer ·
//  infographic → image · rich types → markdown. Documents/presentations always
//  offer Open-in-new-tab + Download so the file is reachable even where inline
//  embedding is limited (e.g. mobile Safari).
export function LessonRenderer({ lesson }: { lesson: Lesson }) {
  switch (lesson.contentType) {
    case "video":
      return <VideoBlock url={resolveUploadUrl(lesson.videoUrl)} />;
    case "pdf":
      return <DocumentViewer url={resolveUploadUrl(lesson.documentUrl)} title={lesson.title} kind="pdf" />;
    case "presentation":
      return <DocumentViewer url={resolveUploadUrl(lesson.documentUrl)} title={lesson.title} kind="presentation" />;
    case "infographic":
      return <ImageBlock url={resolveUploadUrl(lesson.documentUrl || lesson.videoUrl)} alt={lesson.title} />;
    default:
      // rich_text, reflection, activity, case_study
      return (
        <div className="prose-none">
          <MarkdownView markdown={lesson.content} />
        </div>
      );
  }
}

function isEmbeddable(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}

function VideoBlock({ url }: { url: string }) {
  if (!url) return <Empty label="No video attached to this lesson." />;
  if (isEmbeddable(url)) {
    const embed = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
    return (
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-soft">
        <iframe src={embed} className="w-full h-full" allowFullScreen title="Lesson video" />
      </div>
    );
  }
  return (
    // Uploaded (/api/uploads) or direct file URL; the API serves Range requests so seeking works.
    <video
      controls
      src={url}
      preload="metadata"
      playsInline
      controlsList="nodownload"
      className="w-full aspect-video rounded-2xl bg-black shadow-soft"
    >
      Your browser does not support video.
    </video>
  );
}

// Clean, robust viewer for uploaded PDFs and presentations. Uses <object> so the
// browser's native viewer renders inline where supported, with a graceful fallback
// card; the toolbar's Open/Download always work regardless.
function DocumentViewer({
  url,
  title,
  kind,
}: {
  url: string;
  title: string;
  kind: "pdf" | "presentation";
}) {
  if (!url) {
    return (
      <Empty
        label={
          kind === "presentation"
            ? "No presentation attached to this lesson yet."
            : "No document attached to this lesson yet."
        }
      />
    );
  }
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
  const Icon = kind === "presentation" ? Presentation : FileText;
  const label = kind === "presentation" ? "Presentation" : "Document";

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

      {isImage ? (
        <div className={kind === "presentation" ? "aspect-video bg-black" : "bg-black"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={title}
            className={`w-full ${kind === "presentation" ? "h-full object-contain" : ""}`}
          />
        </div>
      ) : (
        <div className={kind === "presentation" ? "aspect-video bg-muted" : "h-[76vh] bg-muted"}>
          <object data={url} type="application/pdf" className="w-full h-full">
            <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This file can&apos;t be previewed inline on this device.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm bg-violet-600 hover:bg-violet-700 text-white transition-colors"
              >
                <Maximize2 className="w-4 h-4" /> Open document
              </a>
            </div>
          </object>
        </div>
      )}
    </figure>
  );
}

function ImageBlock({ url, alt }: { url: string; alt: string }) {
  if (!url) return <Empty label="No image attached to this lesson." />;
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
