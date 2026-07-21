import { buildAppManifest } from "../../src/appManifestModel.js";
import { createSupabaseAppConfigDriverFromEnv } from "../settings/supabaseAppConfigDriver.js";

function sendManifest(res, manifest, { head = false } = {}) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/manifest+json; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  res.end(head ? "" : JSON.stringify(manifest));
}

export function createManifestHandler({
  configDriver = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const backendConfigDriver = configDriver || createSupabaseAppConfigDriverFromEnv(env, fetchImpl);

  return async function manifestHandler(req, res) {
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
    return sendManifest(res, buildAppManifest(config), { head: method === "HEAD" });
  };
}

export default createManifestHandler();
