export const CMMS_ACCESS_COOKIE = "cmms_access_token";
export const CMMS_REFRESH_COOKIE = "cmms_refresh_token";

export const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

export function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index < 0) return cookies;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name) return cookies;
      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export function bearerToken(req = {}) {
  const value = String(getHeader(req.headers, "authorization") || "");
  if (value.startsWith("Bearer ")) return value.slice(7).trim();
  const cookies = parseCookies(getHeader(req.headers, "cookie"));
  return cookies[CMMS_ACCESS_COOKIE] || "";
}

export function refreshToken(req = {}) {
  const cookies = parseCookies(getHeader(req.headers, "cookie"));
  return cookies[CMMS_REFRESH_COOKIE] || "";
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader?.("set-cookie") || res.getHeader?.("Set-Cookie") || res.headers?.["set-cookie"];
  const next = Array.isArray(existing) ? [...existing, cookie] : existing ? [existing, cookie] : [cookie];
  res.setHeader("set-cookie", next);
}

function cookieAttrs({ maxAge = null, env = process.env } = {}) {
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAge !== null) attrs.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (env.NODE_ENV === "production" || env.VERCEL === "1") attrs.push("Secure");
  return attrs.join("; ");
}

export function setAuthCookies(res, auth = {}, { remember = false, env = process.env, now = Date.now() } = {}) {
  const accessToken = auth.access_token || auth.accessToken || "";
  const refresh = auth.refresh_token || auth.refreshToken || "";
  const expiresAt = auth.expiresAt ? Number(auth.expiresAt) : Number(auth.expires_at || 0);
  const expiresIn = Number(auth.expires_in || 0);
  const accessMaxAge = expiresAt
    ? Math.max(1, Math.floor((expiresAt * (auth.expiresAt ? 1 : (expiresAt < 10_000_000_000 ? 1000 : 1)) - now) / 1000))
    : (expiresIn ? Math.max(1, Math.floor(expiresIn)) : 3600);

  if (accessToken) {
    appendSetCookie(res, `${CMMS_ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; ${cookieAttrs({ maxAge: accessMaxAge, env })}`);
  }
  if (refresh) {
    const refreshMaxAge = remember ? 60 * 60 * 24 * 30 : null;
    appendSetCookie(res, `${CMMS_REFRESH_COOKIE}=${encodeURIComponent(refresh)}; ${cookieAttrs({ maxAge: refreshMaxAge, env })}`);
  }
}

export function clearAuthCookies(res, { env = process.env } = {}) {
  appendSetCookie(res, `${CMMS_ACCESS_COOKIE}=; ${cookieAttrs({ maxAge: 0, env })}`);
  appendSetCookie(res, `${CMMS_REFRESH_COOKIE}=; ${cookieAttrs({ maxAge: 0, env })}`);
}

export function cookieAuthPayload(auth = {}, now = Date.now()) {
  const expiresIn = Number(auth.expires_in || 0);
  const expiresAt = auth.expiresAt ? Number(auth.expiresAt) : Number(auth.expires_at || 0);
  return {
    accessToken: "",
    refreshToken: "",
    expiresAt: expiresAt ? (auth.expiresAt ? expiresAt : (expiresAt < 10_000_000_000 ? expiresAt * 1000 : expiresAt)) : (expiresIn ? now + expiresIn * 1000 : 0),
    tokenType: "cookie",
    cookieSession: true
  };
}
