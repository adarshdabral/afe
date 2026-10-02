// Upload + media controllers (Course CMS, platform admin only).
//
// Flow used by the admin UI for every content file (video, audio, PDF/PPT, subtitles)
// of a topic or course section:
//   1. POST /api/admin/uploads/presign  { kind, filename, contentType, size }
//      → R2 configured:  { mode: "r2", uploadUrl, headers, url }  — the browser PUTs
//        the file straight to Cloudflare R2, then saves `url` on the topic/section.
//      → otherwise:      { mode: "local", uploadPath, token }     — the browser POSTs
//        multipart to this backend (uploadPath) with `Authorization: Bearer <token>`.
//   2. (local mode) POST /api/admin/uploads[/video|/audio|/subtitle] — handle() +
//      receiveUpload() have already validated + stored the file; respond with its URL.
// POST /api/admin/tts generates narration audio from topic/section text.

import { z } from "zod";
import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { signUploadToken, UPLOAD_TOKEN_TTL_SECONDS } from "../utils/jwt";
import { objectKey, presignPut, PRESIGN_TTL_SECONDS, publicUrlFor, r2Enabled } from "../utils/r2";
import { assertAllowed, randomName, UPLOAD_KIND_NAMES, UPLOAD_KINDS } from "../utils/storage";
import { AURA_SPEAKERS, generateNarration, MAX_TTS_CHARS, ttsInfo } from "../services/tts.service";

/** Local-mode upload endpoint for each kind (documents keep the original path). */
const LOCAL_UPLOAD_PATH: Record<(typeof UPLOAD_KIND_NAMES)[number], string> = {
  document: "/api/admin/uploads",
  video: "/api/admin/uploads/video",
  audio: "/api/admin/uploads/audio",
  subtitle: "/api/admin/uploads/subtitle",
};

/** POST /api/admin/uploads[/video|/audio|/subtitle] — local-disk upload result. */
export async function uploadFile(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res
      .status(400)
      .json({ error: { message: "No file was uploaded. Attach a file in a field named 'file'." } });
    return;
  }
  res.status(201).json({
    data: {
      url: `/api/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    },
  });
}

function uploadTokenFor(req: Request): string {
  const user = req.user!;
  return signUploadToken({ sub: user.id, role: user.role, registrationStatus: user.registrationStatus });
}

/** POST /api/admin/uploads/token — a 15-minute, upload-only token (local mode). */
export async function uploadToken(req: Request, res: Response): Promise<void> {
  res.json({ data: { token: uploadTokenFor(req), expiresIn: UPLOAD_TOKEN_TTL_SECONDS } });
}

const presignSchema = z.object({
  kind: z.enum(UPLOAD_KIND_NAMES),
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(200),
  size: z.number().int().positive(),
});

/** POST /api/admin/uploads/presign — where/how the browser should upload this file. */
export async function presign(req: Request, res: Response): Promise<void> {
  const { kind, filename, contentType, size } = presignSchema.parse(req.body);
  const spec = UPLOAD_KINDS[kind];
  const ext = assertAllowed(spec, filename, contentType, size); // 415 / 413 before anything is signed

  if (!r2Enabled()) {
    res.json({
      data: {
        mode: "local",
        uploadPath: LOCAL_UPLOAD_PATH[kind],
        token: uploadTokenFor(req),
        maxBytes: spec.maxBytes,
      },
    });
    return;
  }
  const key = objectKey(kind, randomName(ext));
  res.json({
    data: {
      mode: "r2",
      method: "PUT",
      uploadUrl: await presignPut(key, contentType, size),
      headers: { "Content-Type": contentType },
      url: publicUrlFor(key),
      key,
      expiresIn: PRESIGN_TTL_SECONDS,
    },
  });
}

/** GET /api/admin/uploads/config — what the admin UI can offer (limits, storage, TTS). */
export async function config(_req: Request, res: Response): Promise<void> {
  res.json({
    data: {
      storage: r2Enabled() ? "r2" : "local",
      tts: ttsInfo().enabled,
      ttsVoices: ttsInfo().voices,
      ttsDefaultVoice: ttsInfo().defaultVoice,
      maxTtsCharacters: MAX_TTS_CHARS,
      limits: Object.fromEntries(UPLOAD_KIND_NAMES.map((k) => [k, UPLOAD_KINDS[k].maxBytes])),
    },
  });
}

const ttsSchema = z.object({
  text: z.string().min(1).max(200000),
  /** Aura voice; omitted → TTS_VOICE (default "orion", male). */
  voice: z.enum(AURA_SPEAKERS).optional(),
});

/** POST /api/admin/tts — narrate topic/section text → { url } of the generated audio. */
export async function tts(req: Request, res: Response): Promise<void> {
  const { text, voice } = ttsSchema.parse(req.body);
  res.status(201).json({ data: await generateNarration(text, voice) });
}
