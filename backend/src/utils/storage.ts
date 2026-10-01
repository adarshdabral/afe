// File-upload storage for the Course CMS. Uploaded lesson materials (presentation
// decks, PDFs, images — and, via `uploadVideo`, lesson videos) are written to a local `uploads/` directory (relative to the
// backend process cwd) and served read-only at /api/uploads/<filename>. The dir is
// git-ignored and excluded from deploy syncs so files persist across releases.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** 25 MB default; overridable (used by the verify harness to exercise the limit). */
export const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024);

// Presentations, documents, and images only.
const ALLOWED_EXT = new Set([
  ".pdf", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Random, extension-only filename — never trust the client's path/name on disk.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

/** Video lessons are much larger than documents: 500 MB default, overridable. */
export const MAX_VIDEO_UPLOAD_BYTES = Number(
  process.env.UPLOAD_VIDEO_MAX_BYTES ?? 500 * 1024 * 1024,
);

// Browser-playable video containers. MP4 (H.264/AAC) is the most compatible.
const VIDEO_EXT = new Set([".mp4", ".m4v", ".webm", ".mov"]);
const VIDEO_MIME = new Set(["video/mp4", "video/x-m4v", "video/webm", "video/quicktime"]);

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error(
      "Unsupported file type. Upload a PDF, PowerPoint, or image (PNG/JPG/GIF/WEBP/SVG).",
    ) as Error & { statusCode?: number };
    err.statusCode = 415;
    cb(err);
  },
});

/** Separate instance for lesson videos: video-only allow-list + the larger cap. */
export const uploadVideo = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (VIDEO_EXT.has(ext) && VIDEO_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error("Unsupported video type. Upload an MP4, WebM, or MOV file.") as Error & {
      statusCode?: number;
    };
    err.statusCode = 415;
    cb(err);
  },
});
