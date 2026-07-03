import { createHmac, timingSafeEqual } from "crypto";

const base64urlJson = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signCmmsSessionToken(userId, role, workerNo, secret, nowMs = Date.now(), ttlMs = 86400000) {
  const cleanSecret = String(secret || "").trim();
  if (!cleanSecret) return null;
  const sub = String(userId || "").trim();
  if (!sub) return null;

  const header = base64urlJson({ alg: "HS256", typ: "CMMS" });
  const exp = Math.floor((nowMs + ttlMs) / 1000);
  const payload = base64urlJson({
    sub,
    role: String(role || ""),
    workerNo: String(workerNo || ""),
    exp
  });
  const signature = createHmac("sha256", cleanSecret).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt: exp * 1000 };
}

export function verifyCmmsSessionToken(token, secret, nowMs = Date.now()) {
  try {
    const cleanSecret = String(secret || "").trim();
    if (!cleanSecret) return null;
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;

    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    if (header?.alg !== "HS256" || header?.typ !== "CMMS") return null;

    const expected = createHmac("sha256", cleanSecret).update(`${headerPart}.${payloadPart}`).digest("base64url");
    const signatureBuffer = Buffer.from(signaturePart, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    const exp = Number(payload?.exp || 0);
    if (!exp || exp <= Math.floor(nowMs / 1000)) return null;
    const sub = String(payload?.sub || "").trim();
    if (!sub) return null;

    return {
      id: sub,
      role: String(payload?.role || ""),
      workerNo: String(payload?.workerNo || ""),
      expiresAt: exp * 1000
    };
  } catch {
    return null;
  }
}
