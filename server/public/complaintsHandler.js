import { createHash, randomUUID } from "node:crypto";
import { createSupabaseKvDriverFromEnv } from "../kv/supabaseDriver.js";
import { createSupabaseFileDriverFromEnv } from "../files/supabaseFileDriver.js";
import { createSupabaseFileMetadataDriverFromEnv } from "../files/supabaseFileMetadataDriver.js";
import { sendServerError } from "../httpErrors.js";
import { cleaningComplaintPhotoMetadata } from "../../src/fileMetadataModel.js";
import { createSupabaseCleaningComplaintsDriverFromEnv } from "../cleaning/supabaseCleaningRecordsDriver.js";
import { createSupabaseCleaningZonesDriverFromEnv } from "../cleaning/supabaseCleaningZonesDriver.js";

const MAX_BODY_BYTES = 2_200_000;
const MAX_PHOTO_CHARS = 2_000_000;
const MAX_TEXT_CHARS = 700;
const RATE_LIMIT_MS = 60_000;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const parseBool = (value) => value === true || value === "1" || value === "true";

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const cleanText = (value, limit = MAX_TEXT_CHARS) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const zoneLoc = (zone = {}) => [zone.building, zone.floor].filter(Boolean).join(" · ");

const safeZoneId = (value) => {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? id : "";
};

const safeKind = (value) => {
  const kind = String(value || "").trim();
  return kind === "broken" || kind === "dirty" ? kind : "";
};

const safePhoto = (value) => {
  const photo = String(value || "");
  if (!photo || photo.length > MAX_PHOTO_CHARS) return "";
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(photo) ? photo : "";
};

const photoFileFromDataUrl = (value = "") => {
  const photo = safePhoto(value);
  const match = photo.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const contentType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  return {
    contentType,
    ext: contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg",
    buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64")
  };
};

const safePathSegment = (value) => String(value || "item").replace(/[^a-zA-Z0-9._-]/g, "-");

const publicComplaintPhotoPath = (complaintId, file) => `cleaning/complaints/${safePathSegment(complaintId)}/photo.${file.ext}`;

const requestFingerprint = (req) => {
  const forwarded = String(getHeader(req.headers, "x-forwarded-for") || "").split(",")[0].trim();
  const realIp = String(getHeader(req.headers, "x-real-ip") || "").trim();
  const userAgent = String(getHeader(req.headers, "user-agent") || "").slice(0, 160);
  return `${forwarded || realIp || "unknown"}|${userAgent}`;
};

const hashKey = (value) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("payload_too_large");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
};

const parseStoredJson = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export function buildPublicComplaintRecord({ body = {}, zone = {}, now = Date.now(), id = randomUUID() } = {}) {
  const kind = safeKind(body.kind);
  const text = cleanText(body.text) || (kind === "broken" ? "דווחה תקלה" : "דווח לכלוך");
  return {
    id,
    at: now,
    zoneId: zone.id,
    zoneName: cleanText(zone.name, 160),
    zoneLoc: zoneLoc(zone),
    kind,
    text,
    photo: safePhoto(body.photo),
    status: "pending",
    ownerRole: "cleaner",
    verified: false,
    ticketId: null,
    reportedById: "",
    reportedByName: "דיווח אנונימי",
    reportedByRole: "anonymous",
    source: "public_endpoint",
    demo: false
  };
}

export function validatePublicComplaintPayload(body = {}) {
  const zoneId = safeZoneId(body.zoneId);
  if (!zoneId) return { ok: false, status: 400, error: "zone_id_required" };
  if (!safeKind(body.kind)) return { ok: false, status: 400, error: "kind_invalid" };
  if (!safePhoto(body.photo)) return { ok: false, status: 400, error: "photo_required" };
  return { ok: true, zoneId };
}

export function createPublicComplaintHandler({
  driver = null,
  complaintsDriver = null,
  zonesDriver = null,
  fileDriver = null,
  metadataDriver = null,
  env = process.env,
  now = () => Date.now(),
  createId = () => randomUUID(),
  fetchImpl = globalThis.fetch
} = {}) {
  const backendDriver = driver
    || (env.CMMS_PUBLIC_COMPLAINTS_DRIVER === "supabase" || env.CMMS_KV_DRIVER === "supabase"
      ? createSupabaseKvDriverFromEnv(env, fetchImpl)
      : null);
  const backendComplaintsDriver = complaintsDriver
    || (env.CMMS_CLEANING_COMPLAINTS_DRIVER === "supabase" || env.CMMS_STORAGE_PROVIDER === "api"
      ? createSupabaseCleaningComplaintsDriverFromEnv(env, fetchImpl)
      : null);
  const backendZonesDriver = zonesDriver
    || (env.CMMS_CLEANING_ZONES_DRIVER === "supabase" || env.CMMS_STORAGE_PROVIDER === "api"
      ? createSupabaseCleaningZonesDriverFromEnv(env, fetchImpl)
      : null);
  const requireFileStorage = env.CMMS_FILE_DRIVER === "supabase";
  const backendFileDriver = fileDriver
    || (requireFileStorage ? createSupabaseFileDriverFromEnv(env, fetchImpl) : null);
  const backendMetadataDriver = metadataDriver
    || (env.CMMS_FILE_METADATA_DRIVER === "supabase" ? createSupabaseFileMetadataDriverFromEnv(env, fetchImpl) : null);

  return async function publicComplaintHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    if (!parseBool(env.CMMS_PUBLIC_COMPLAINTS_ENABLED)) {
      return json(res, 503, { error: "public_complaints_disabled" });
    }
    if (!backendDriver) return json(res, 503, { error: "public_complaints_backend_not_configured" });

    try {
      const body = await readBody(req);
      const validated = validatePublicComplaintPayload(body);
      if (!validated.ok) return json(res, validated.status, { error: validated.error });
      if (requireFileStorage && !backendFileDriver) return json(res, 503, { error: "public_complaint_file_storage_not_configured" });
      if (requireFileStorage && !backendMetadataDriver) return json(res, 503, { error: "public_complaint_file_metadata_not_configured" });

      const currentTime = now();
      const rateKey = `publicComplaintRate:${hashKey(requestFingerprint(req))}`;
      const last = Number(await backendDriver.get(rateKey, false) || 0);
      const rateLimitMs = Number(env.CMMS_PUBLIC_COMPLAINT_RATE_LIMIT_MS || RATE_LIMIT_MS) || RATE_LIMIT_MS;
      if (last && currentTime - last < rateLimitMs) {
        return json(res, 429, { error: "public_complaint_rate_limited" });
      }

      const zone = backendZonesDriver?.get
        ? await backendZonesDriver.get(validated.zoneId)
        : parseStoredJson(await backendDriver.get(`czone:${validated.zoneId}`, true));
      if (!zone || zone.active === false) return json(res, 404, { error: "zone_not_found" });
      const complaint = buildPublicComplaintRecord({
        body,
        zone: { ...zone, id: validated.zoneId },
        now: currentTime,
        id: createId()
      });
      if (requireFileStorage) {
        const file = photoFileFromDataUrl(complaint.photo);
        if (!file || !file.buffer.length) return json(res, 400, { error: "photo_required" });
        const photoPath = publicComplaintPhotoPath(complaint.id, file);
        const metadata = cleaningComplaintPhotoMetadata(complaint, photoPath, {
          contentType: file.contentType,
          sizeBytes: file.buffer.length,
          createdByRole: "anonymous",
          createdAt: complaint.at
        });
        await backendFileDriver.upload(photoPath, file.buffer, file.contentType, {
          id: "",
          name: "דיווח אנונימי",
          role: "anonymous"
        });
        try {
          await backendMetadataDriver.upsert(metadata);
        } catch (error) {
          try { await backendFileDriver.delete?.(photoPath); } catch {}
          throw error;
        }
        complaint.photo = null;
        complaint.photoPath = photoPath;
        complaint.hasPhoto = true;
      }

      if (backendComplaintsDriver) await backendComplaintsDriver.upsert(complaint);
      await backendDriver.set(rateKey, String(currentTime), false);
      if (!backendComplaintsDriver) await backendDriver.set(`ccomplaint:${complaint.id}`, JSON.stringify(complaint), true);
      return json(res, 201, { ok: true, id: complaint.id, status: complaint.status });
    } catch (error) {
      if (error?.message === "payload_too_large") return json(res, 413, { error: "payload_too_large" });
      if (error?.message === "invalid_json") return json(res, 400, { error: "invalid_json" });
      return sendServerError(req, res, error, { code: "public_complaint_error", route: "/api/public/complaints" });
    }
  };
}

export default createPublicComplaintHandler();
