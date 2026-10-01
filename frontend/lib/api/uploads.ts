// File-upload API client. Files go STRAIGHT to the backend (not through the
// frontend's /api proxy, which isn't meant for 500 MB bodies): the admin first
// gets a 15-minute upload-only token via the normal (cookie) API, then posts the
// file to the backend with `Authorization: Bearer <token>`. The backend returns a
// root-relative URL ("/api/uploads/<file>") that is stored on the lesson and
// resolved to the backend origin for display (resolveUploadUrl).

import axios from "axios";
import { api } from "./axios";
import { BACKEND_URL } from "@/lib/backend";

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
  const { data: tokenRes } = await api.post<{ data: { token: string } }>("/admin/uploads/token");
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post<{ data: UploadResult }>(`${BACKEND_URL}/api${path}`, form, {
    headers: { Authorization: `Bearer ${tokenRes.data.token}` },
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
 * Resolve an uploaded root-relative URL ("/api/uploads/…") to the backend origin,
 * so media (videos especially) streams straight from the backend rather than
 * through the frontend's proxy. Absolute URLs (YouTube, external files) pass through.
 */
export function resolveUploadUrl(url: string): string {
  return url.startsWith("/api/uploads/") ? `${BACKEND_URL}${url}` : url;
}
