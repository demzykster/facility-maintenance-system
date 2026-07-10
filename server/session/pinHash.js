import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(nodeScrypt);
const DEFAULT_PARAMS = Object.freeze({ n: 16384, r: 8, p: 1, keyLength: 32, saltBytes: 16 });
const MAXMEM_BYTES = 64 * 1024 * 1024;

const safeString = (value) => String(value || "").trim();

export async function hashPin(pin, {
  randomBytesImpl = randomBytes,
  scryptImpl = scryptAsync,
  params = DEFAULT_PARAMS
} = {}) {
  const cleanPin = safeString(pin);
  if (!cleanPin) throw new Error("pin_required");
  const salt = randomBytesImpl(params.saltBytes).toString("base64url");
  const derived = await scryptImpl(cleanPin, salt, params.keyLength, {
    N: params.n,
    r: params.r,
    p: params.p,
    maxmem: MAXMEM_BYTES
  });
  return [
    "scrypt",
    params.n,
    params.r,
    params.p,
    params.keyLength,
    salt,
    Buffer.from(derived).toString("base64url")
  ].join("$");
}

export async function verifyPin(pin, encodedHash, { scryptImpl = scryptAsync } = {}) {
  const cleanPin = safeString(pin);
  const parts = String(encodedHash || "").split("$");
  if (!cleanPin || parts.length !== 7 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const keyLength = Number(parts[4]);
  const salt = parts[5];
  const expected = Buffer.from(parts[6], "base64url");
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keyLength) || !salt || expected.length !== keyLength) return false;

  const derived = Buffer.from(await scryptImpl(cleanPin, salt, keyLength, {
    N: n,
    r,
    p,
    maxmem: MAXMEM_BYTES
  }));
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
