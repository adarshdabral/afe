// SERVER-ONLY. The `.server.ts` suffix keeps this (and the SESSION_SECRET it
// reads) out of the client bundle. Provides the sealed session cookie helper
// plus Web-Crypto password hashing that runs on Node and the Cloudflare Workers
// target alike (no native bcrypt/argon2 dependency).

import { useSession } from "@tanstack/react-start/server";
import type { Role, SessionPrincipal } from "./access";

export interface SessionData {
  user?: SessionPrincipal;
}

/**
 * Resolve the session cookie secret per request (never at module scope — on
 * Cloudflare Workers env binds per request). Fails closed in production.
 */
function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters in production.",
    );
  }
  // Dev-only fallback (>= 32 chars). Set SESSION_SECRET in .env for real use.
  return "afe-dev-insecure-session-secret__change_me";
}

/** httpOnly, signed/sealed session cookie. Call inside a server handler. */
export function useAppSession() {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  return useSession<SessionData>({
    name: "afe_session",
    password: sessionPassword(),
    maxAge,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    },
  });
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-HMAC-SHA256 via Web Crypto). Format string:
//   pbkdf2$<iterations>$<saltB64>$<hashB64>
// ---------------------------------------------------------------------------

const ITERATIONS = 100_000;
const KEY_BITS = 256;
const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const computed = await deriveBits(password, fromB64(saltB64), Number(iterStr));
  return timingSafeEqual(computed, fromB64(hashB64));
}

export type { Role };
