// The learning-CONTENT fields shared by Topics and Course Sections (Introduction,
// Overview, Meet the Instructor). Any combination may be present:
//   content     — text (markdown)
//   audioUrl    — narration (uploaded, or generated from the text via text-to-speech)
//   documentUrl — PDF / PowerPoint (or an image)
//   videoUrl    — video, with optional subtitleUrl (WebVTT; SRT uploads are converted)
// Media URLs are absolute (Cloudflare R2 public URL, YouTube/Vimeo, external) or
// root-relative `/api/uploads/<file>` (local-disk fallback).

export const CONTENT_TYPES = [
  "video",
  "pdf",
  "presentation",
  "rich_text",
  "infographic",
  "case_study",
  "reflection",
  "activity",
  "discussion",
] as const;
/** The primary-format label of a piece of content. */
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface ContentFieldsView {
  contentType: ContentType;
  content: string;
  audioUrl: string;
  documentUrl: string;
  videoUrl: string;
  subtitleUrl: string;
}

/** Mongoose schema definition for the content fields (spread into a schema). */
export const contentFieldsSchema = {
  contentType: { type: String, enum: CONTENT_TYPES, required: true, default: "rich_text" },
  content: { type: String, default: "" }, // markdown
  audioUrl: { type: String, default: "" },
  documentUrl: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  subtitleUrl: { type: String, default: "" },
} as const;

export function toContentFields(doc: Partial<Record<keyof ContentFieldsView, unknown>>): ContentFieldsView {
  return {
    contentType: (doc.contentType as ContentType) ?? "rich_text",
    content: (doc.content as string) ?? "",
    audioUrl: (doc.audioUrl as string) ?? "",
    documentUrl: (doc.documentUrl as string) ?? "",
    videoUrl: (doc.videoUrl as string) ?? "",
    subtitleUrl: (doc.subtitleUrl as string) ?? "",
  };
}
