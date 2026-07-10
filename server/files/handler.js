import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { createSupabaseFileDriverFromEnv } from "./supabaseFileDriver.js";
import { createSupabaseFileMetadataDriverFromEnv } from "./supabaseFileMetadataDriver.js";
import { sendServerError } from "../httpErrors.js";
import { bearerToken } from "../session/authCookie.js";
import { AUDIT_ACTIONS, fileAuditEvent } from "../../src/auditEventModel.js";
import { FILE_OWNER_TYPES, fileMetadataPathMatchesOwner, normalizeFileMetadata } from "../../src/fileMetadataModel.js";
import { canPerformCleaning, canViewCleaningReports } from "../../src/cleaningAccessModel.js";
import { kvWritePermissionError, permissionLevelRank, sessionPermissionLevel } from "../kv/permissionPolicy.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

const normalizePath = (value = "") => {
  const path = String(Array.isArray(value) ? value.join("/") : value).trim().replace(/^\/+/, "");
  if (!path || path.includes("..") || path.includes("//")) return "";
  return path;
};

const allowedPrefixesFromEnv = (env = {}) => {
  const raw = String(env.CMMS_FILE_ALLOWED_PREFIXES || "tickets/,cleaning/");
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
};

const isAllowedPath = (path, allowedPrefixes = []) => (
  allowedPrefixes.some((prefix) => path === prefix.replace(/\/+$/, "") || path.startsWith(prefix))
);

const bufferFromBody = (body = {}) => {
  const raw = String(body.data || body.value || "");
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  const contentType = body.contentType || (match ? match[1] : "application/octet-stream");
  const base64 = match ? match[2] : raw;
  if (!base64) return null;
  return {
    contentType,
    buffer: Buffer.from(base64, "base64")
  };
};

const fileMaxBytesFromEnv = (env = {}) => {
  const value = Number(env.CMMS_FILE_MAX_BYTES || 10 * 1024 * 1024);
  return Number.isFinite(value) && value > 0 ? value : 10 * 1024 * 1024;
};

async function authorize(req, env, fetchImpl, sessionClient) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };
  const client = sessionClient || createSupabaseSessionClient({
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    fetchImpl
  });
  if (!client) return { ok: false, status: 503, error: "supabase_session_not_configured" };

  try {
    const authUser = await client.getAuthUser(token);
    const profile = await client.getAppUserProfile(token, authUser?.id);
    const session = buildSessionPayload(authUser, profile);
    if (!session.ok) return { ok: false, status: session.error === "app_user_disabled" ? 403 : 401, error: session.error };
    if (session.user.mustChangePassword) return { ok: false, status: 403, error: "password_change_required" };
    return { ok: true, user: session.user };
  } catch {
    return { ok: false, status: 401, error: "supabase_session_failed" };
  }
}

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
  if (typeof auditDriver.set === "function") return auditDriver.set(event);
};

const buildUploadMetadata = (metadata, { path, file, user }) => {
  if (!metadata || typeof metadata !== "object") return null;
  const normalized = normalizeFileMetadata({
    ...metadata,
    path,
    contentType: file.contentType,
    sizeBytes: file.buffer.length,
    createdById: metadata.createdById || user.id,
    createdByName: metadata.createdByName || user.name,
    createdByRole: metadata.createdByRole || user.role
  });
  if (!fileMetadataPathMatchesOwner(normalized)) throw new Error("file_metadata_path_owner_mismatch");
  return normalized;
};

const requireActiveMetadata = async (metadataDriver, path) => {
  if (typeof metadataDriver?.findActiveByPath !== "function") return { ok: true, metadata: null };
  const metadata = await metadataDriver.findActiveByPath(path);
  if (!metadata) return { ok: false, status: 404, error: "file_metadata_not_found" };
  if (!fileMetadataPathMatchesOwner(metadata)) return { ok: false, status: 400, error: "file_metadata_path_owner_mismatch" };
  return { ok: true, metadata };
};

const hasModuleLevel = (user = {}, module, minLevel = "view") => (
  permissionLevelRank(sessionPermissionLevel(user, module)) >= permissionLevelRank(minLevel)
);

const canReadTicketFile = (user = {}) => ["admin", "user", "tech", "worker"].includes(user.role);

const canReadCleaningFile = (user = {}) => (
  user.role === "admin"
  || user.role === "user"
  || canPerformCleaning(user)
  || canViewCleaningReports(user)
);

const ownerWriteKey = (metadata = {}) => {
  if (metadata.ownerType === FILE_OWNER_TYPES.ticket) return `ticket:${metadata.ownerId}`;
  if (metadata.ownerType === FILE_OWNER_TYPES.cleaningComplaint) return `ccomplaint:${metadata.ownerId}`;
  if (metadata.ownerType === FILE_OWNER_TYPES.cleaningRound) return `cround:${metadata.ownerId}`;
  return "";
};

const fileOwnerPermissionError = ({ metadata = null, user = {}, action = "read" } = {}) => {
  if (!metadata) return null;
  if (user.role === "admin") return null;

  if (action !== "read") {
    const key = ownerWriteKey(metadata);
    if (key && kvWritePermissionError(user, key)) {
      return metadata.ownerType === FILE_OWNER_TYPES.ticket
        ? "permission_required:files:ticket"
        : "permission_required:files:cleaning";
    }
  }

  if (metadata.ownerType === FILE_OWNER_TYPES.ticket) {
    return canReadTicketFile(user) ? null : "permission_required:files:ticket";
  }
  if (metadata.ownerType === FILE_OWNER_TYPES.cleaningComplaint || metadata.ownerType === FILE_OWNER_TYPES.cleaningRound) {
    return canReadCleaningFile(user) ? null : "permission_required:files:cleaning";
  }
  if (metadata.ownerType === FILE_OWNER_TYPES.user) {
    const ownUserFile = user.id && String(user.id) === String(metadata.ownerId);
    return ownUserFile || hasModuleLevel(user, "users", "view") ? null : "permission_required:files:user";
  }

  return hasModuleLevel(user, "settings", action === "read" ? "view" : "manage")
    ? null
    : "permission_required:files:manage";
};

export function createFileApiHandler({ driver = null, auditDriver = null, metadataDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver
    || (env.CMMS_FILE_DRIVER === "supabase" ? createSupabaseFileDriverFromEnv(env, fetchImpl) : null);
  const backendAuditDriver = auditDriver
    || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);
  const backendMetadataDriver = metadataDriver
    || (env.CMMS_FILE_METADATA_DRIVER === "supabase" ? createSupabaseFileMetadataDriverFromEnv(env, fetchImpl) : null);
  const fileMaxBytes = fileMaxBytesFromEnv(env);
  const allowedPrefixes = allowedPrefixesFromEnv(env);

  return async function fileApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "file_storage_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      const path = normalizePath(req.query?.path);
      if (!path) return json(res, 400, { error: "path_required" });
      if (!isAllowedPath(path, allowedPrefixes)) return json(res, 403, { error: "file_path_forbidden" });

      if (method === "GET") {
        const metadata = await requireActiveMetadata(backendMetadataDriver, path);
        if (!metadata.ok) return json(res, metadata.status, { error: metadata.error });
        const permissionError = fileOwnerPermissionError({ metadata: metadata.metadata, user: auth.user, action: "read" });
        if (permissionError) return json(res, 403, { error: permissionError });
        const file = await backendDriver.download(path, auth.user);
        return json(res, 200, {
          path,
          contentType: file.contentType,
          data: file.buffer.toString("base64")
        });
      }
      if (method === "POST" || method === "PUT") {
        const body = await readBody(req);
        const file = bufferFromBody(body);
        if (!file || !file.buffer.length) return json(res, 400, { error: "file_data_required" });
        if (file.buffer.length > fileMaxBytes) return json(res, 413, { error: "file_too_large", maxBytes: fileMaxBytes });
        if (backendMetadataDriver && !body.metadata) return json(res, 400, { error: "file_metadata_required" });
        if (body.metadata && !backendMetadataDriver) return json(res, 503, { error: "file_metadata_not_configured" });
        let metadata = null;
        try {
          metadata = buildUploadMetadata(body.metadata, { path, file, user: auth.user });
        } catch (error) {
          if (error?.message === "file_metadata_path_owner_mismatch") return json(res, 400, { error: error.message });
          throw error;
        }
        const permissionError = fileOwnerPermissionError({ metadata, user: auth.user, action: "write" });
        if (permissionError) return json(res, 403, { error: permissionError });
        await backendDriver.upload(path, file.buffer, file.contentType, auth.user);
        if (metadata) await backendMetadataDriver?.upsert?.(metadata);
        await writeAuditEvent(backendAuditDriver, fileAuditEvent({ path, contentType: file.contentType }, AUDIT_ACTIONS.upload, auth.user));
        return json(res, 200, { ok: true, path, contentType: file.contentType });
      }
      if (method === "DELETE") {
        const metadata = await requireActiveMetadata(backendMetadataDriver, path);
        if (!metadata.ok) return json(res, metadata.status, { error: metadata.error });
        const permissionError = fileOwnerPermissionError({ metadata: metadata.metadata, user: auth.user, action: "delete" });
        if (permissionError) return json(res, 403, { error: permissionError });
        await backendDriver.delete(path, auth.user);
        await backendMetadataDriver?.markDeletedByPath?.(path);
        await writeAuditEvent(backendAuditDriver, fileAuditEvent({ path }, AUDIT_ACTIONS.delete, auth.user));
        return json(res, 200, { ok: true, path });
      }

      res.setHeader("allow", "GET, POST, PUT, DELETE");
      return json(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      return sendServerError(req, res, error, { code: "file_storage_error", route: "/api/files" });
    }
  };
}

export default createFileApiHandler();
