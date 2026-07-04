"use client";

import { FileText, Download } from "lucide-react";
import { MarkdownView } from "./MarkdownView";
import type { Lesson } from "@/lib/api/courses";

// Renders a lesson by contentType:
//  video → embedded player · pdf → embedded viewer + download · infographic →
//  image · rich_text / reflection / activity / case_study → markdown.
export function LessonRenderer({ lesson }: { lesson: Lesson }) {
  switch (lesson.contentType) {
    case "video":
      return <VideoBlock url={lesson.videoUrl} />;
    case "pdf":
      return <PdfBlock url={lesson.documentUrl} />;
    case "infographic":
      return <ImageBlock url={lesson.documentUrl || lesson.videoUrl} alt={lesson.title} />;
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
    const embed = url
      .replace("watch?v=", "embed/")
      .replace("youtu.be/", "youtube.com/embed/");
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
        <iframe src={embed} className="w-full h-full" allowFullScreen title="Lesson video" />
      </div>
    );
  }
  return (
    <video controls src={url} className="w-full rounded-xl bg-black">
      Your browser does not support video.
    </video>
  );
}

function PdfBlock({ url }: { url: string }) {
  if (!url) return <Empty label="No document attached to this lesson." />;
  return (
    <div>
      <div className="aspect-[4/5] w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <iframe src={url} className="w-full h-full" title="Lesson document" />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline mt-2"
      >
        <Download className="w-4 h-4" /> Download
      </a>
    </div>
  );
}

function ImageBlock({ url, alt }: { url: string; alt: string }) {
  if (!url) return <Empty label="No image attached to this lesson." />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-full rounded-xl border border-gray-200 dark:border-gray-700" />;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-muted-foreground">
      <FileText className="w-8 h-8 mx-auto mb-2" />
      {label}
    </div>
  );
}
