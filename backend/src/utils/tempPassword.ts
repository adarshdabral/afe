// Temporary-password generator for admin-provisioned teacher accounts. Uses the
// Web Crypto CSPRNG (global on Node 18+ / Workers) — never Math.random. The
// alphabet omits visually ambiguous characters (0/O, 1/l/I) so the credential is
// easy to read out or type. One digit + one symbol are forced in for strength.

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = LETTERS + DIGITS + SYMBOLS;

function pick(chars: string): string {
  const idx = crypto.getRandomValues(new Uint32Array(1))[0] % chars.length;
  return chars[idx];
}

/** Generate a random, human-readable temporary password (default 12 chars). */
export function generateTemporaryPassword(length = 12): string {
  const size = Math.max(8, length);
  const out: string[] = [pick(DIGITS), pick(SYMBOLS)];
  while (out.length < size) out.push(pick(ALL));
  // Fisher–Yates shuffle so the forced digit/symbol aren't always in front.
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
