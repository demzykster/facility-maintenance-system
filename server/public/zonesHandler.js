import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createSupabaseCleaningZonesDriverFromEnv } from "../cleaning/supabaseCleaningZonesDriver.js";

const PUBLIC_ZONE_FIELDS = ["id", "name", "building", "floor", "code", "active"];

const json = (res, status, body, headers = {}) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
};

const parseStoredJson = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const publicZone = (record = {}) => Object.fromEntries(
  PUBLIC_ZONE_FIELDS.map((field) => [field, record[field] ?? (field === "active" ? true : "")])
);

export function createPublicZonesHandler({
  driver = null,
  zonesDriver = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const backendDriver = driver
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
  const backendZonesDriver = zonesDriver
    || (env.CMMS_CLEANING_ZONES_DRIVER === "supabase" || env.CMMS_STORAGE_PROVIDER === "api"
      ? createSupabaseCleaningZonesDriverFromEnv(env, fetchImpl)
      : null);

  return async function publicZonesHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "GET") {
      res.setHeader("allow", "GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }
    if (!backendZonesDriver?.list && !backendDriver?.listValues) {
      return json(res, 503, { ok: false, error: "zones_backend_not_configured" });
    }

    try {
      const sourceZones = backendZonesDriver?.list
        ? await backendZonesDriver.list()
        : (await backendDriver.listValues("czone:", true))
          .map((row) => ({ key: row.key, zone: parseStoredJson(row.value) }))
          .filter(({ zone }) => zone)
          .map(({ key, zone }) => ({ ...zone, id: zone.id || key.replace(/^czone:/, "") }));
      const zones = sourceZones
        .filter((zone) => zone && zone.active !== false)
        .map((zone) => publicZone(zone))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he"));

      return json(res, 200, { ok: true, zones }, { "cache-control": "public, max-age=60" });
    } catch {
      return json(res, 500, { ok: false, error: "zones_load_failed" });
    }
  };
}

export default createPublicZonesHandler();
