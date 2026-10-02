// Text-to-speech for topic and course-section narration via Cloudflare Workers AI (REST API).
//
//   CLOUDFLARE_ACCOUNT_ID — account id (falls back to R2_ACCOUNT_ID)
//   CLOUDFLARE_AI_TOKEN   — API token with "Workers AI - Read" + "Workers AI - Edit"
//   TTS_MODEL             — default @cf/deepgram/aura-2-en (Deepgram Aura-2: { text, speaker },
//                           MP3 out, 40+ voices). @cf/myshell-ai/melotts takes { prompt, lang },
//                           returns WAV and has a single voice.
//   TTS_VOICE             — default Aura voice (default "orion", a male voice); the admin
//                           can pick another per narration
//   TTS_LANG              — MeloTTS language code (default "en")
//
// Neither model has a speed setting; learners get slower playback in the player
// (default 0.9×, pitch preserved by the browser).
//
// Long text is split at sentence boundaries into chunks, each synthesized
// separately, then joined into ONE file: WAV chunks (what MeloTTS returns) are
// merged sample-for-sample under a rebuilt RIFF header; MP3 chunks (Deepgram aura)
// are byte-concatenated (MP3 frames are self-contained). The finished file is
// stored in R2 (or the local uploads dir when R2 isn't configured).

import { HttpError } from "../http/errors";
import { objectKey, putObject, r2Enabled } from "../utils/r2";
import { randomName, saveLocal } from "../utils/storage";

const DEFAULT_MODEL = "@cf/deepgram/aura-2-en";
const DEFAULT_VOICE = "orion";

/** Aura-2 English speakers (Cloudflare model page). */
export const AURA_SPEAKERS = [
  "amalthea", "andromeda", "apollo", "arcas", "aries", "asteria", "athena", "atlas", "aurora",
  "callista", "cora", "cordelia", "delia", "draco", "electra", "harmonia", "helena", "hera",
  "hermes", "hyperion", "iris", "janus", "juno", "jupiter", "luna", "mars", "minerva", "neptune",
  "odysseus", "ophelia", "orion", "orpheus", "pandora", "phoebe", "pluto", "saturn", "thalia",
  "theia", "vesta", "zeus",
] as const;
export type AuraSpeaker = (typeof AURA_SPEAKERS)[number];

/** Voices offered in the editor (genders per Deepgram's voice docs). */
export const VOICE_CHOICES: { id: AuraSpeaker; label: string; gender: "male" | "female" }[] = [
  { id: "orion", label: "Orion — male, American", gender: "male" },
  { id: "arcas", label: "Arcas — male, American", gender: "male" },
  { id: "apollo", label: "Apollo — male, American", gender: "male" },
  { id: "aries", label: "Aries — male, American", gender: "male" },
  { id: "zeus", label: "Zeus — male, American", gender: "male" },
  { id: "orpheus", label: "Orpheus — male, American", gender: "male" },
  { id: "draco", label: "Draco — male, British", gender: "male" },
  { id: "thalia", label: "Thalia — female, American", gender: "female" },
  { id: "andromeda", label: "Andromeda — female, American", gender: "female" },
  { id: "helena", label: "Helena — female, American", gender: "female" },
  { id: "luna", label: "Luna — female, American", gender: "female" },
];
/** Characters per synthesis request (conservative; long prompts degrade/timeout). */
const CHUNK_CHARS = 800;
/** Upper bound on narrated text per request (cost + time guard). */
export const MAX_TTS_CHARS = 30000;

function ttsConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.R2_ACCOUNT_ID?.trim() || "";
  const token = process.env.CLOUDFLARE_AI_TOKEN?.trim() || "";
  if (!accountId || !token) return null;
  return {
    accountId,
    token,
    model: process.env.TTS_MODEL?.trim() || DEFAULT_MODEL,
    voice: process.env.TTS_VOICE?.trim() || DEFAULT_VOICE,
    lang: process.env.TTS_LANG?.trim() || "en",
    apiBase: (process.env.CLOUDFLARE_API_BASE?.trim() || "https://api.cloudflare.com/client/v4").replace(/\/+$/, ""),
  };
}

export function ttsEnabled(): boolean {
  return ttsConfig() !== null;
}

/** What the editor can offer: voices only for Deepgram Aura models. */
export function ttsInfo() {
  const cfg = ttsConfig();
  const model = process.env.TTS_MODEL?.trim() || DEFAULT_MODEL;
  const hasVoices = model.includes("deepgram");
  return {
    enabled: cfg !== null,
    model,
    voices: hasVoices ? VOICE_CHOICES : [],
    defaultVoice: hasVoices ? process.env.TTS_VOICE?.trim() || DEFAULT_VOICE : null,
  };
}

/** Markdown → plain narration text (drops syntax, keeps the words). */
export function markdownToSpeechText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, "$1.")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\|/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Split text into ≤ max-char chunks at sentence (then word) boundaries. */
export function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const s of sentences) {
    if ((cur + s).length <= max) {
      cur += s;
      continue;
    }
    push();
    if (s.length <= max) {
      cur = s;
      continue;
    }
    for (const word of s.split(" ")) {
      if ((cur + " " + word).length > max) push();
      cur += (cur ? " " : "") + word;
    }
  }
  push();
  return chunks;
}

async function synthesizeChunk(
  cfg: NonNullable<ReturnType<typeof ttsConfig>>,
  text: string,
  voice: string,
): Promise<Uint8Array> {
  const body = cfg.model.includes("deepgram") ? { text, speaker: voice } : { prompt: text, lang: cfg.lang };
  const res = await fetch(`${cfg.apiBase}/accounts/${cfg.accountId}/ai/run/${cfg.model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const detail = type.includes("json") ? JSON.stringify((await res.json().catch(() => null))?.errors ?? "") : "";
    throw new HttpError(502, `Text-to-speech failed (${res.status}). ${detail}`.trim());
  }
  // Workers AI returns either raw audio bytes or a JSON envelope { result: { audio: <base64> } }.
  if (type.startsWith("audio/") || type.includes("octet-stream")) return new Uint8Array(await res.arrayBuffer());
  const json = (await res.json().catch(() => null)) as { result?: { audio?: string } } | null;
  const b64 = json?.result?.audio;
  if (!b64) throw new HttpError(502, "Text-to-speech returned no audio.");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

type AudioFormat = { ext: ".wav" | ".mp3" | ".ogg"; contentType: string };

/** Identify synthesized audio by its magic bytes. */
export function detectAudio(b: Uint8Array): AudioFormat | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { ext: ".wav", contentType: "audio/wav" };
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: ".mp3", contentType: "audio/mpeg" };
  if (ascii(0, 4) === "OggS") return { ext: ".ogg", contentType: "audio/ogg" };
  return null;
}

/** The `fmt ` and `data` chunks of a RIFF/WAVE file. */
function wavChunks(b: Uint8Array): { fmt: Uint8Array; data: Uint8Array } {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fmt: Uint8Array | null = null;
  let data: Uint8Array | null = null;
  for (let off = 12; off + 8 <= b.length; ) {
    const id = String.fromCharCode(...b.subarray(off, off + 4));
    const size = view.getUint32(off + 4, true);
    const body = b.subarray(off + 8, Math.min(off + 8 + size, b.length));
    if (id === "fmt ") fmt = body;
    if (id === "data") data = body;
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) throw new HttpError(502, "Text-to-speech returned an unreadable WAV file.");
  return { fmt, data };
}

/** Merge WAV files with identical formats into one (samples back to back). */
export function mergeWav(parts: Uint8Array[]): Uint8Array {
  const chunks = parts.map(wavChunks);
  const fmt = chunks[0].fmt;
  const same = (a: Uint8Array) => a.length === fmt.length && a.every((v, i) => v === fmt[i]);
  if (!chunks.every((c) => same(c.fmt))) throw new HttpError(502, "Text-to-speech chunks have different audio formats.");
  const dataLen = chunks.reduce((n, c) => n + c.data.length, 0);
  const out = new Uint8Array(12 + 8 + fmt.length + 8 + dataLen);
  const view = new DataView(out.buffer);
  const put = (off: number, s: string) => [...s].forEach((ch, i) => (out[off + i] = ch.charCodeAt(0)));
  put(0, "RIFF");
  view.setUint32(4, out.length - 8, true);
  put(8, "WAVE");
  put(12, "fmt ");
  view.setUint32(16, fmt.length, true);
  out.set(fmt, 20);
  let off = 20 + fmt.length;
  put(off, "data");
  view.setUint32(off + 4, dataLen, true);
  off += 8;
  for (const c of chunks) {
    out.set(c.data, off);
    off += c.data.length;
  }
  return out;
}

/** Join synthesized chunks into one file of the detected format. */
export function joinAudio(parts: Uint8Array[]): { bytes: Uint8Array; format: AudioFormat } {
  const format = detectAudio(parts[0]);
  if (!format || !parts.every((p) => detectAudio(p)?.ext === format.ext)) {
    throw new HttpError(502, "Text-to-speech returned audio in an unexpected format.");
  }
  if (parts.length === 1) return { bytes: parts[0], format };
  if (format.ext === ".wav") return { bytes: mergeWav(parts), format };
  if (format.ext === ".mp3") {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return { bytes: out, format };
  }
  throw new HttpError(502, "Long narration isn't supported for this audio format — use a shorter text.");
}

export interface TtsResult {
  url: string;
  contentType: string;
  voice: string | null;
  bytes: number;
  characters: number;
  chunks: number;
}

/** Narrate `text` (markdown allowed) → audio (WAV or MP3, per model) stored in R2 or locally. */
export async function generateNarration(text: string, voice?: string): Promise<TtsResult> {
  const cfg = ttsConfig();
  if (!cfg) {
    throw new HttpError(503, "Text-to-speech isn't configured (set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN).");
  }
  const speech = markdownToSpeechText(text);
  if (!speech) throw new HttpError(400, "There is no text to narrate.");
  if (speech.length > MAX_TTS_CHARS) {
    throw new HttpError(413, `Text is too long to narrate (max ${MAX_TTS_CHARS.toLocaleString()} characters).`);
  }
  const chunks = chunkText(speech);
  const parts: Uint8Array[] = [];
  const speaker = voice || cfg.voice;
  for (const chunk of chunks) parts.push(await synthesizeChunk(cfg, chunk, speaker)); // sequential: keeps order, gentle on rate limits
  const { bytes: audio, format } = joinAudio(parts);

  const filename = randomName(format.ext);
  const url = r2Enabled()
    ? await putObject(objectKey("audio", filename), audio, format.contentType)
    : (await saveLocal(audio, format.ext)).url;
  const usedVoice = cfg.model.includes("deepgram") ? speaker : null;
  return { url, contentType: format.contentType, voice: usedVoice, bytes: audio.length, characters: speech.length, chunks: chunks.length };
}
