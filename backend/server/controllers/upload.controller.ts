// Upload controller (Course CMS). handle() + receiveUpload() have already validated + stored the file
// on disk by the time this runs; here we just shape the response with a URL the
// frontend can reference (e.g. as a lesson's documentUrl).

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { signUploadToken, UPLOAD_TOKEN_TTL_SECONDS } from "../utils/jwt";

/** POST /api/admin/uploads — returns the public URL of the stored file. */
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

/**
 * POST /api/admin/uploads/token — a 15-minute, upload-only token. The admin UI
 * (on another origin, e.g. Vercel) sends large files straight to this backend with
 * `Authorization: Bearer <token>` instead of through the frontend's /api proxy.
 */
export async function uploadToken(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.json({
    data: {
      token: signUploadToken({ sub: user.id, role: user.role, registrationStatus: user.registrationStatus }),
      expiresIn: UPLOAD_TOKEN_TTL_SECONDS,
    },
  });
}
