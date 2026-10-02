// Topic / course-section media upload client (admin). Every file — video, audio, PDF/PPT, subtitles —
// goes through one flow:
//   1. ask the backend where to put it:  POST /api/admin/uploads/presign
//   2a. Cloudflare R2 configured → PUT the file straight to R2 with the presigned URL
//       (heavy files never touch our servers) and keep the returned public URL;
//   2b. otherwise → POST it straight to the backend (not through the frontend's /api
//       proxy) with the short-lived upload token, and keep the returned
//       "/api/uploads/<file>" URL.
// Also: SRT → WebVTT conversion for captions, and text-to-speech narration.

import axios from "axios";
import { api } from "./axios";
import { BACKEND_URL } from "@/lib/backend";

export type UploadKind = "document" | "video" | "audio" | "subtitle";

export interface UploadResult {
  url: string;
  originalName: string;
  size: number;
}

/** File-picker accept attributes — match the backend allow-lists. */
export const UPLOAD_ACCEPT = ".pdf,.ppt,.pptx,image/*";
export const VIDEO_UPLOAD_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov";
export const AUDIO_UPLOAD_ACCEPT = "audio/*,.mp3,.m4a,.aac,.wav,.ogg";
export const SUBTITLE_UPLOAD_ACCEPT = ".srt,.vtt,text/vtt,application/x-subrip";

/** Defaults for fast client-side checks (the backend reports the real ones). */
export const DEFAULT_LIMITS: Record<UploadKind, number> = {
  document: 25 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  subtitle: 2 * 1024 * 1024,
};

export interface TtsVoice {
  id: string;
  label: string;
  gender: "male" | "female";
}

export interface UploadConfig {
  storage: "r2" | "local";
  tts: boolean;
  /** Voices the narration model offers (empty for single-voice models). */
  ttsVoices: TtsVoice[];
  ttsDefaultVoice: string | null;
  maxTtsCharacters: number;
  limits: Record<UploadKind, number>;
}

export async function getUploadConfig(): Promise<UploadConfig> {
  const { data } = await api.get<{ data: UploadConfig }>("/admin/uploads/config");
  return data.data;
}

/** Called with 0–100 as the upload progresses. */
export type UploadProgress = (percent: number) => void;

type Presigned =
  | { mode: "r2"; uploadUrl: string; headers: Record<string, string>; url: string }
  | { mode: "local"; uploadPath: string; token: string };

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  vtt: "text/vtt",
};

/** Browsers sometimes report an empty/odd MIME type (e.g. .pptx, .m4a on Windows). */
function mimeOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return EXT_MIME[ext] ?? (file.type || "application/octet-stream");
}

function progressHandler(onProgress?: UploadProgress) {
  return (e: { loaded: number; total?: number }) => {
    if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
  };
}

/** Upload one content file of the given kind; returns the URL to store on the topic or section. */
export async function uploadMedia(kind: UploadKind, file: File, onProgress?: UploadProgress): Promise<UploadResult> {
  const contentType = mimeOf(file);
  const { data } = await api.post<{ data: Presigned }>("/admin/uploads/presign", {
    kind,
    filename: file.name,
    contentType,
    size: file.size,
  });
  const target = data.data;

  if (target.mode === "r2") {
    await axios.put(target.uploadUrl, file, {
      headers: target.headers,
      onUploadProgress: progressHandler(onProgress),
    });
    return { url: target.url, originalName: file.name, size: file.size };
  }

  const form = new FormData();
  // Re-wrap so the part carries the normalized MIME type the backend validates.
  form.append("file", new Blob([file], { type: contentType }), file.name);
  const res = await axios.post<{ data: UploadResult }>(`${BACKEND_URL}${target.uploadPath}`, form, {
    headers: { Authorization: `Bearer ${target.token}` },
    onUploadProgress: progressHandler(onProgress),
  });
  return res.data.data;
}

/** Back-compat helpers. */
export const uploadFile = (file: File, onProgress?: UploadProgress) => uploadMedia("document", file, onProgress);
export const uploadVideo = (file: File, onProgress?: UploadProgress) => uploadMedia("video", file, onProgress);

/** SRT → WebVTT (what <track> needs): header, `,` → `.` in timestamps, drop cue numbers. */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((cue) => {
      const lines = cue.split("\n");
      if (/^\d+$/.test(lines[0]?.trim() ?? "") && lines[1]?.includes("-->")) lines.shift();
      if (lines[0]) lines[0] = lines[0].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
      return lines.join("\n");
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

/** Upload captions: .srt is converted to .vtt in the browser first. */
export async function uploadSubtitles(file: File, onProgress?: UploadProgress): Promise<UploadResult> {
  const text = await file.text();
  const isVtt = /^﻿?WEBVTT/.test(text);
  if (!isVtt && !/-->/.test(text)) throw new Error("That doesn't look like an SRT or VTT subtitle file.");
  const vtt = isVtt ? text : srtToVtt(text);
  const name = file.name.replace(/\.(srt|vtt)$/i, "") + ".vtt";
  return uploadMedia("subtitle", new File([vtt], name, { type: "text/vtt" }), onProgress);
}

/** Generate narration audio from topic/section text (markdown) via text-to-speech. */
export async function generateNarration(
  text: string,
  voice?: string,
): Promise<{ url: string; characters: number; voice: string | null }> {
  const { data } = await api.post<{ data: { url: string; characters: number; voice: string | null } }>(
    "/admin/tts",
    voice ? { text, voice } : { text },
    { timeout: 300000 },
  );
  return data.data;
}

/** Readable API error message (the backend sends `{ error: { message } }`). */
export function uploadErrorMessage(err: unknown, fallback = "Upload failed"): string {
  const e = err as {
    response?: { status?: number; data?: { error?: { message?: string } } | string };
    message?: string;
  };
  const data = e?.response?.data;
  if (data && typeof data === "object" && data.error?.message) return data.error.message;
  if (e?.response?.status === 413) return "File is too large.";
  if (e?.response?.status === 403 && typeof data === "string" && data.includes("SignatureDoesNotMatch"))
    return "Upload was rejected by storage (signature mismatch). Please try again.";
  if (e?.message === "Network Error") return "Network error — check the storage CORS settings and your connection.";
  return e?.message ?? fallback;
}

/**
 * Resolve a stored media URL for the browser. Root-relative "/api/uploads/…" files
 * (local storage) load straight from the backend origin; absolute URLs (Cloudflare
 * R2, YouTube, external) pass through.
 */
export function resolveUploadUrl(url: string): string {
  return url.startsWith("/api/uploads/") ? `${BACKEND_URL}${url}` : url;
}
