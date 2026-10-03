// Media storage for the Course CMS (topic and course-section content).
//
// PRIMARY: Cloudflare R2 (when the R2_* env vars are set — see ./r2.ts). The
// browser uploads straight to R2 with a short-lived presigned PUT URL, so large
// files (videos, audio, decks) never pass through this server; topics store the
// object's public URL. Generated audio (text-to-speech) is written to R2 server-side.
//
// FALLBACK (no R2 configured — local dev, verify harnesses, self-hosted): files are
// written to UPLOAD_DIR on this server and served at /api/uploads/<file>.
// Multipart bodies are STREAMED to disk with busboy (never buffered in memory).
// Same rules everywhere: per-kind extension AND MIME allow-list (415), size cap
// (413), random server-side names.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import busboy from "busboy";
import { HttpError } from "../http/errors";
import type { UploadedFile } from "../http/types";

/**
 * Where local-mode uploads are stored. If the configured UPLOAD_DIR can't be created
 * (e.g. UPLOAD_DIR=/var/data/uploads on a Render service without its disk attached),
 * fall back to ./uploads instead of throwing at import time — a throw here would take
 * down every route that imports this module. The fallback is NOT persistent on
 * Render, hence the loud warning.
 */
function resolveUploadDir(): string {
  const configured = path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || "uploads");
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (err) {
    const fallback = path.resolve(process.cwd(), "uploads");
    console.error(
      `[uploads] UPLOAD_DIR "${configured}" is not writable (${(err as Error).message}); ` +
        `using "${fallback}" instead — files there are lost on redeploy. Attach a disk or unset UPLOAD_DIR.`,
    );
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

export const UPLOAD_DIR = resolveUploadDir();

const MB = 1024 * 1024;
const envBytes = (key: string, fallback: number) => Number(process.env[key] || fallback);

/** Size caps (overridable — the verify harness uses small values). */
export const MAX_UPLOAD_BYTES = envBytes("UPLOAD_MAX_BYTES", 25 * MB);
export const MAX_VIDEO_UPLOAD_BYTES = envBytes("UPLOAD_VIDEO_MAX_BYTES", 500 * MB);
export const MAX_AUDIO_UPLOAD_BYTES = envBytes("UPLOAD_AUDIO_MAX_BYTES", 100 * MB);
export const MAX_SUBTITLE_UPLOAD_BYTES = envBytes("UPLOAD_SUBTITLE_MAX_BYTES", 2 * MB);

export const UPLOAD_KIND_NAMES = ["document", "video", "audio", "subtitle"] as const;
export type UploadKindName = (typeof UPLOAD_KIND_NAMES)[number];

export interface UploadKind {
  name: UploadKindName;
  maxBytes: number;
  ext: Set<string>;
  mime: Set<string>;
  rejectMessage: string;
}

// PDF / PowerPoint decks and images.
export const DOCUMENT_UPLOAD: UploadKind = {
  name: "document",
  maxBytes: MAX_UPLOAD_BYTES,
  ext: new Set([".pdf", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]),
  mime: new Set([
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ]),
  rejectMessage: "Unsupported file type. Upload a PDF, PowerPoint, or image (PNG/JPG/GIF/WEBP/SVG).",
};

// Browser-playable video containers. MP4 (H.264/AAC) is the most compatible.
export const VIDEO_UPLOAD: UploadKind = {
  name: "video",
  maxBytes: MAX_VIDEO_UPLOAD_BYTES,
  ext: new Set([".mp4", ".m4v", ".webm", ".mov"]),
  mime: new Set(["video/mp4", "video/x-m4v", "video/webm", "video/quicktime"]),
  rejectMessage: "Unsupported video type. Upload an MP4, WebM, or MOV file.",
};

// Narration audio.
export const AUDIO_UPLOAD: UploadKind = {
  name: "audio",
  maxBytes: MAX_AUDIO_UPLOAD_BYTES,
  ext: new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".webm"]),
  mime: new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/webm",
  ]),
  rejectMessage: "Unsupported audio type. Upload an MP3, M4A, AAC, WAV, OGG or WebM file.",
};

// Video captions. Browsers only play WebVTT in <track>; the admin UI converts
// SRT → VTT before uploading.
export const SUBTITLE_UPLOAD: UploadKind = {
  name: "subtitle",
  maxBytes: MAX_SUBTITLE_UPLOAD_BYTES,
  ext: new Set([".vtt"]),
  mime: new Set(["text/vtt"]),
  rejectMessage: "Unsupported subtitle file. Upload an .srt or .vtt file.",
};

export const UPLOAD_KINDS: Record<UploadKindName, UploadKind> = {
  document: DOCUMENT_UPLOAD,
  video: VIDEO_UPLOAD,
  audio: AUDIO_UPLOAD,
  subtitle: SUBTITLE_UPLOAD,
};

/** Validate a declared file (name + MIME + size) against a kind; throws 415/413/400. */
export function assertAllowed(kind: UploadKind, filename: string, mimeType: string, size?: number): string {
  const ext = path.extname(filename ?? "").toLowerCase();
  if (!kind.ext.has(ext) || !kind.mime.has(mimeType)) throw new HttpError(415, kind.rejectMessage);
  if (size !== undefined) {
    if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, "File is empty.");
    if (size > kind.maxBytes) throw new HttpError(413, "File is too large.");
  }
  return ext;
}

/** Random, extension-only name — never trust the client's path/name. */
export function randomName(ext: string): string {
  return `${Date.now()}-${crypto.randomUUID()}${ext}`;
}

/** Content types used when serving stored files. */
export const SERVE_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".vtt": "text/vtt; charset=utf-8",
};

/** Local fallback: write bytes (e.g. generated audio) to UPLOAD_DIR. */
export async function saveLocal(bytes: Uint8Array, ext: string): Promise<{ url: string; filename: string }> {
  const filename = randomName(ext);
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return { url: `/api/uploads/${filename}`, filename };
}

/**
 * Local fallback: stream the single `file` part of a multipart request to
 * UPLOAD_DIR. Resolves with the stored file (or undefined when no `file` part).
 */
export async function receiveUpload(request: Request, kind: UploadKind): Promise<UploadedFile | undefined> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data") || !request.body) return undefined;

  return new Promise<UploadedFile | undefined>((resolve, reject) => {
    let result: UploadedFile | undefined;
    let pending: Promise<void> | null = null;
    let failed = false;

    const fail = (err: unknown) => {
      if (failed) return;
      failed = true;
      reject(err);
    };

    let bb: busboy.Busboy;
    try {
      bb = busboy({
        headers: { "content-type": contentType },
        limits: { fileSize: kind.maxBytes, files: 1 },
      });
    } catch {
      fail(new HttpError(400, "Malformed multipart request."));
      return;
    }

    bb.on("file", (field, stream, info) => {
      if (field !== "file" || result || pending) {
        stream.resume();
        fail(new HttpError(400, "Unexpected field"));
        return;
      }
      let ext: string;
      try {
        ext = assertAllowed(kind, info.filename, info.mimeType);
      } catch (err) {
        stream.resume();
        fail(err);
        return;
      }
      const filename = randomName(ext);
      const dest = path.join(UPLOAD_DIR, filename);
      let size = 0;
      let truncated = false;
      stream.on("data", (chunk: Buffer) => (size += chunk.length));
      stream.on("limit", () => (truncated = true));
      pending = pipeline(stream, fs.createWriteStream(dest)).then(
        () => {
          if (truncated) {
            fs.rmSync(dest, { force: true });
            throw new HttpError(413, "File is too large.");
          }
          result = { filename, originalname: info.filename, size, mimetype: info.mimeType };
        },
        (err) => {
          fs.rmSync(dest, { force: true });
          throw err;
        },
      );
      pending.catch(fail);
    });

    bb.on("error", () => fail(new HttpError(400, "Malformed multipart request.")));
    bb.on("close", () => {
      if (failed) return;
      Promise.resolve(pending)
        .then(() => resolve(result))
        .catch(fail);
    });

    Readable.fromWeb(request.body as unknown as NodeWebReadableStream<Uint8Array>)
      .on("error", () => fail(new HttpError(400, "Upload was interrupted.")))
      .pipe(bb);
  });
}
