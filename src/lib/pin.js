// PIN hanya disimpan di perangkat (hash PBKDF2 + salt). Server tidak pernah menerima PIN.
// Login sebenarnya memakai email + password; PIN adalah kunci cepat pembuka aplikasi.
const keyOf = (uid) => `gb_pin_${uid}`;
export const MAX_PIN_FAILS = 5;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120000 }, base, 256);
}

export const pinExists = (uid) => !!localStorage.getItem(keyOf(uid));

export async function setPin(uid, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt);
  localStorage.setItem(keyOf(uid), JSON.stringify({ salt: toB64(salt), hash: toB64(hash), fails: 0 }));
}

// -> { ok, failsLeft }
export async function verifyPin(uid, pin) {
  const raw = localStorage.getItem(keyOf(uid));
  if (!raw) return { ok: false, failsLeft: 0 };
  const rec = JSON.parse(raw);
  const hash = toB64(await derive(pin, fromB64(rec.salt)));
  if (hash === rec.hash) {
    rec.fails = 0;
    localStorage.setItem(keyOf(uid), JSON.stringify(rec));
    return { ok: true, failsLeft: MAX_PIN_FAILS };
  }
  rec.fails = (rec.fails || 0) + 1;
  localStorage.setItem(keyOf(uid), JSON.stringify(rec));
  return { ok: false, failsLeft: Math.max(0, MAX_PIN_FAILS - rec.fails) };
}

export const clearPin = (uid) => localStorage.removeItem(keyOf(uid));
