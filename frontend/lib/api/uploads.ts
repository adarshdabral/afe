// File-upload API client. Uploads go to the admin-only endpoint and return a URL
// (e.g. "/api/uploads/<file>") that can be stored as a lesson's documentUrl. The
// URL is same-origin/root-relative, so it can be used directly as an <iframe>/<img>
// src in the browser.

import { api } from "./axios";

export interface UploadResult {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

/** Accept attribute for the file picker — matches the backend's allowed types. */
export const UPLOAD_ACCEPT = ".pdf,.ppt,.pptx,image/*";

/** Accept attribute for lesson videos — matches the backend's video allow-list. */
export const VIDEO_UPLOAD_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov";
/** Mirrors the backend default UPLOAD_VIDEO_MAX_BYTES (500 MB) for a fast client-side check. */
export const VIDEO_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

/** Called with 0–100 as the upload progresses. */
export type UploadProgress = (percent: number) => void;

async function post(path: string, file: File, onProgress?: UploadProgress): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data: UploadResult }>(path, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.data;
}

/** Upload a single document/image and return its stored URL + metadata. */
export function uploadFile(file: File, onProgress?: UploadProgress): Promise<UploadResult> {
  return post("/admin/uploads", file, onProgress);
}

/** Upload a lesson video (MP4/WebM/MOV) and return its stored URL + metadata. */
export function uploadVideo(file: File, onProgress?: UploadProgress): Promise<UploadResult> {
  return post("/admin/uploads/video", file, onProgress);
}

/** Readable API error message (the backend sends `{ error: { message } }`). */
export function uploadErrorMessage(err: unknown, fallback = "Upload failed"): string {
  const e = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
  if (e?.response?.status === 413) return "File is too large.";
  return e?.response?.data?.error?.message ?? e?.message ?? fallback;
}

/**
 * Resolve an uploaded root-relative URL ("/api/uploads/…") for the browser. In
 * production the API is same-origin so it is returned unchanged; in development
 * (API on another port) it is prefixed with the API origin so media still loads.
 */
export function resolveUploadUrl(url: string): string {
  if (!url.startsWith("/api/")) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
  try {
    return new URL(url, new URL(base).origin).toString();
  } catch {
    return url; // relative base (e.g. "/api") → already same-origin
  }
}
