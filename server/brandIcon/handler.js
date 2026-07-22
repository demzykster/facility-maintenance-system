import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSupabaseAppConfigDriverFromEnv } from "../settings/supabaseAppConfigDriver.js";

const FALLBACK_ICON_PATH = join(process.cwd(), "public", "icons", "icon-512-brand-20260711.png");
const DATA_IMAGE_RE = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

let fallbackIcon = null;

function fallbackBrandIcon() {
  if (!fallbackIcon) fallbackIcon = readFileSync(FALLBACK_ICON_PATH);
  return { body: fallbackIcon, type: "image/png" };
}

export function brandLogoImageFromConfig(config = {}) {
  const raw = String(config.brandLogo || "").trim();
  const match = raw.match(DATA_IMAGE_RE);
  if (!match) return null;
  try {
    const body = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
    if (!body.length) return null;
    return { body, type: match[1].toLowerCase().replace("image/jpg", "image/jpeg") };
  } catch {
    return null;
  }
}

function sendImage(res, image, { head = false } = {}) {
  res.statusCode = 200;
  res.setHeader("content-type", image.type);
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.end(head ? "" : image.body);
}

export function createBrandIconHandler({
  configDriver = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const backendConfigDriver = configDriver || createSupabaseAppConfigDriverFromEnv(env, fetchImpl);

  return async function brandIconHandler(req, res) {
    const method = String(req?.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      res.statusCode = 405;
      res.setHeader("content-type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "method_not_allowed" }));
    }

    let config = {};
    try {
      config = (await backendConfigDriver?.get?.())?.config || {};
    } catch {
      config = {};
    }

    return sendImage(res, brandLogoImageFromConfig(config) || fallbackBrandIcon(), { head: method === "HEAD" });
  };
}

export default createBrandIconHandler();
