// Cloudflare R2 (S3-compatible object storage) for topic and course-section media.
//
// Enabled when all of these are set (blank counts as unset):
//   R2_ACCOUNT_ID        — Cloudflare account id (S3 endpoint host)
//   R2_ACCESS_KEY_ID     — R2 API token: Access Key ID   (Object Read & Write on the bucket)
//   R2_SECRET_ACCESS_KEY — R2 API token: Secret Access Key
//   R2_BUCKET            — bucket name
//   R2_PUBLIC_URL        — public base URL for reads: the bucket's r2.dev URL or a
//                          custom domain, e.g. https://media.example.com (no trailing slash)
//
// Uploads use presigned PUT URLs against https://<ACCOUNT_ID>.r2.cloudflarestorage.com
// (region "auto"); the signature covers Content-Type and Content-Length, so the
// browser can't swap the file type or exceed the declared size. The bucket needs a
// CORS rule allowing PUT from the frontend origin (see DEPLOY.md / scripts).

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

const read = (k: string) => process.env[k]?.trim() || "";

export function r2Config(): R2Config | null {
  const cfg = {
    accountId: read("R2_ACCOUNT_ID"),
    accessKeyId: read("R2_ACCESS_KEY_ID"),
    secretAccessKey: read("R2_SECRET_ACCESS_KEY"),
    bucket: read("R2_BUCKET"),
    publicUrl: read("R2_PUBLIC_URL").replace(/\/+$/, ""),
  };
  return Object.values(cfg).every(Boolean) ? cfg : null;
}

export function r2Enabled(): boolean {
  return r2Config() !== null;
}

let client: { key: string; s3: S3Client } | null = null;
function s3(cfg: R2Config): S3Client {
  const endpoint = process.env.R2_ENDPOINT?.trim() || `https://${cfg.accountId}.r2.cloudflarestorage.com`;
  const key = `${endpoint}|${cfg.accessKeyId}|${cfg.secretAccessKey}`;
  if (!client || client.key !== key) {
    client = {
      key,
      s3: new S3Client({
        region: "auto",
        endpoint,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        forcePathStyle: true, // https://<account>.r2.cloudflarestorage.com/<bucket>/<key> (supported by R2)
      }),
    };
  }
  return client.s3;
}

function requireConfig(): R2Config {
  const cfg = r2Config();
  if (!cfg) throw Object.assign(new Error("Cloudflare R2 is not configured."), { statusCode: 503 });
  return cfg;
}

/** Object key: `<kind>/<yyyy>/<mm>/<random>.<ext>` (kinds: video, audio, document, subtitle). */
export function objectKey(kind: string, filename: string): string {
  const d = new Date();
  return `${kind}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${filename}`;
}

export function publicUrlFor(key: string): string {
  return `${requireConfig().publicUrl}/${key}`;
}

export const PRESIGN_TTL_SECONDS = 60 * 60; // 1 hour — long enough for a 500 MB upload on a slow link

/** A presigned PUT URL bound to this exact Content-Type and Content-Length. */
export async function presignPut(key: string, contentType: string, size: number): Promise<string> {
  const cfg = requireConfig();
  return getSignedUrl(
    s3(cfg),
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: PRESIGN_TTL_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** Server-side write (e.g. text-to-speech audio). Returns the public URL. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const cfg = requireConfig();
  await s3(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrlFor(key);
}

/** Best-effort delete of an object we own (by its public URL). */
export async function deleteByPublicUrl(url: string): Promise<void> {
  const cfg = r2Config();
  if (!cfg || !url.startsWith(`${cfg.publicUrl}/`)) return;
  const key = url.slice(cfg.publicUrl.length + 1);
  await s3(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })).catch(() => {});
}
