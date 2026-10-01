// File-upload storage for the Course CMS. Uploaded lesson materials (presentation
// decks, PDFs, images — and lesson videos) are written to a local `uploads/`
// directory (relative to the server process cwd, override with UPLOAD_DIR) and
// served read-only at /api/uploads/<filename> (app/api/uploads/[...path]). The
// dir is git-ignored and excluded from deploy syncs so files persist across releases.
//
// Multipart bodies are STREAMED to disk with busboy (never buffered in memory), so
// 500 MB videos don't blow the process memory cap. Same rules multer enforced:
// a single `file` field, extension AND MIME allow-list (415), size cap (413, the
// partial file is deleted), random server-side filenames.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import busboy from "busboy";
import { HttpError } from "../http/errors";
import type { UploadedFile } from "../http/types";

export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** 25 MB default; overridable (used by the verify harness to exercise the limit). */
export const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024);

/** Video lessons are much larger than documents: 500 MB default, overridable. */
export const MAX_VIDEO_UPLOAD_BYTES = Number(
  process.env.UPLOAD_VIDEO_MAX_BYTES ?? 500 * 1024 * 1024,
);

export interface UploadKind {
  maxBytes: number;
  ext: Set<string>;
  mime: Set<string>;
  rejectMessage: string;
}

// Presentations, documents, and images.
export const DOCUMENT_UPLOAD: UploadKind = {
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
  maxBytes: MAX_VIDEO_UPLOAD_BYTES,
  ext: new Set([".mp4", ".m4v", ".webm", ".mov"]),
  mime: new Set(["video/mp4", "video/x-m4v", "video/webm", "video/quicktime"]),
  rejectMessage: "Unsupported video type. Upload an MP4, WebM, or MOV file.",
};

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
};

/**
 * Stream the single `file` part of a multipart request to UPLOAD_DIR.
 * Resolves with the stored file (or undefined when no `file` part was sent).
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
      const ext = path.extname(info.filename ?? "").toLowerCase();
      if (!kind.ext.has(ext) || !kind.mime.has(info.mimeType)) {
        stream.resume();
        fail(new HttpError(415, kind.rejectMessage));
        return;
      }
      // Random, extension-only filename — never trust the client's path/name on disk.
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
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
