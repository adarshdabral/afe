// /api/uploads/<file> — read-only serving of uploaded lesson materials
// (presentations, PDFs, images, videos, audio, subtitles) from UPLOAD_DIR — the
// local fallback when Cloudflare R2 isn't configured. Public: no directory listing,
// dotfiles hidden, path traversal rejected, HTTP Range supported so media seeks,
// and `Access-Control-Allow-Origin: *` so the frontend can load captions
// (<track crossorigin>) from this origin.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { SERVE_CONTENT_TYPES, UPLOAD_DIR } from "@/server/utils/storage";

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () =>
  Response.json({ error: { message: "File not found." } }, { status: 404 });

async function serve(request: Request, { params }: Ctx, headOnly: boolean): Promise<Response> {
  const parts = (await params).path ?? [];
  if (parts.length !== 1 || parts[0].startsWith(".") || parts[0].includes("..")) return notFound();
  const file = path.join(UPLOAD_DIR, parts[0]);
  if (path.dirname(file) !== UPLOAD_DIR) return notFound();

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return notFound();
  }
  if (!stat.isFile()) return notFound();

  const headers = new Headers({
    "Content-Type": SERVE_CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=604800",
    "Last-Modified": stat.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  });
  // ?download=<name> (set by the topic download endpoint) saves instead of displaying.
  const downloadName = new URL(request.url).searchParams.get("download");
  if (downloadName) {
    const safe = downloadName.replace(/["\\\r\n/]/g, "_").slice(0, 200);
    headers.set("Content-Disposition", `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
  }
  // SVGs can carry scripts; if one is opened directly (not via <img>), block them.
  if (path.extname(file).toLowerCase() === ".svg") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  }

  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] || m[2])) {
      if (m[1]) {
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      } else {
        start = Math.max(0, stat.size - Number(m[2])); // suffix range: last N bytes
      }
      if (start > end || start >= stat.size) {
        headers.set("Content-Range", `bytes */${stat.size}`);
        return new Response(null, { status: 416, headers });
      }
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    }
  }
  headers.set("Content-Length", String(end - start + 1));
  if (headOnly || stat.size === 0) return new Response(null, { status, headers });

  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}

export function GET(request: Request, ctx: Ctx) {
  return serve(request, ctx, false);
}
export function HEAD(request: Request, ctx: Ctx) {
  return serve(request, ctx, true);
}
