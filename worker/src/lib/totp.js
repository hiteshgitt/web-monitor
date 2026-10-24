// Time-based one-time codes (RFC 6238, the 6-digit codes of Google Authenticator, Authy, 1Password...)
// for admin 2-step verification. HMAC-SHA1, 30-second steps, as every authenticator app expects.

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

export async function totpAt(secretBytes, step, digits = DIGITS) {
  const counter = new Uint8Array(8);
  let n = step;
  for (let i = 7; i >= 0; i -= 1) {
    counter[i] = n & 255;
    n = Math.floor(n / 256);
  }
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = mac[mac.length - 1] & 15;
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

// Returns the matched time step (store it, so the same code can't be used twice), or null.
// One step either side is accepted for phone clocks that are slightly off.
export async function verifyTotp(secret, code, lastStep = -1, now = Date.now()) {
  const entered = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(entered)) return null;
  const bytes = base32Decode(secret);
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (step > (lastStep ?? -1) && (await totpAt(bytes, step)) === entered) return step;
  }
  return null;
}

export const totpUri = (secret, account, issuer = 'Web Monitor Admin') => (
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
);
