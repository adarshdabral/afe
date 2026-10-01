// Upload controller (Course CMS). multer has already validated + stored the file
// on disk by the time this runs; here we just shape the response with a URL the
// frontend can reference (e.g. as a lesson's documentUrl).

import type { Request, Response } from "express";

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
