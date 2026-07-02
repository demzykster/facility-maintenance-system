import { createUpstashKvDriverFromEnv } from "./upstashDriver.js";
import { createSupabaseKvDriverFromEnv } from "./supabaseDriver.js";
import { kvReadValueForSession, kvWritePermissionError, kvWritePermissionForKey, sensitiveKvWriteAuditEvent } from "./permissionPolicy.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { sendServerError } from "../httpErrors.js";
import { ticketStatusAuditEvent } from "../../src/auditEventModel.js";

const KV_KEY_PATTERN = /^[A-Za-z0-9:_@./=+-]+$/;
const KV_RATE_BUCKETS = new Map();
const DEFAULT_KV_RATE_LIMIT_MAX = 600;
const DEFAULT_KV_RATE_LIMIT_WINDOW_MS = 60_000;
const ALLOWED_KV_PREFIXES = Object.freeze([
  "user:",
  "config:v1",
  "fleet:",
  "pm:",
  "insp:",
  "itpl:",
  "photo:",
  "ppe:",
  "ppeitem:",
  "ppenorm:",
  "ppeorder:",
  "czone:",
  "cround:",
  "ccomplaint:",
  "cabsence:",
  "ticket:",
  "ppereq:",
  "presence:",
  "mtask:",
  "mmeet:",
  "appIssue:",
  "pushSubscriptions:v1"
]);

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

const parseBool = (value) => value === true || value === "1" || value === "true";
const parsePrefixes = (value) => {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  return [...new Set(raw.split(",").map((prefix) => prefix.trim()).filter(Boolean))];
};

const getHeader = (headers = {}, name) => {
  const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  if (direct) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? match[1] : "";
};

const bearerToken = (req) => {
  const value = String(getHeader(req.headers, "authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
};

const parsePositiveInt = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
};

const isKnownKvPrefix = (key = "") => ALLOWED_KV_PREFIXES.some((prefix) => String(key || "").startsWith(prefix));

const kvKeyValidationError = (key = "") => {
  const recordKey = String(key || "");
  if (!recordKey || recordKey.length > 512) return "key_required";
  if (!KV_KEY_PATTERN.test(recordKey)) return "key_invalid";
  if (!isKnownKvPrefix(recordKey)) return "key_prefix_not_allowed";
  return null;
};

const kvPrefixValidationError = (prefix = "") => {
  const recordPrefix = String(prefix || "");
  if (!recordPrefix) return null;
  if (recordPrefix.length > 128) return "prefix_invalid";
  if (!KV_KEY_PATTERN.test(recordPrefix)) return "prefix_invalid";
  if (!ALLOWED_KV_PREFIXES.some((allowed) => allowed.startsWith(recordPrefix) || recordPrefix.startsWith(allowed))) return "prefix_not_allowed";
  return null;
};

const requestIp = (req) => {
  const forwarded = String(getHeader(req.headers, "x-forwarded-for") || "");
  return forwarded.split(",")[0].trim() || String(getHeader(req.headers, "x-real-ip") || "") || "unknown";
};

const rateLimitIdentity = (req, auth) => {
  if (auth?.user?.id) return `user:${auth.user.id}`;
  if (auth?.user?.workerNo) return `worker:${auth.user.workerNo}`;
  const token = bearerToken(req);
  if (token) return `bearer:${token.slice(0, 16)}`;
  return `ip:${requestIp(req)}`;
};

const checkKvRateLimit = (req, auth, env, now = Date.now()) => {
  if (parseBool(env.CMMS_KV_RATE_LIMIT_DISABLED)) return null;
  const max = parsePositiveInt(env.CMMS_KV_RATE_LIMIT_MAX, DEFAULT_KV_RATE_LIMIT_MAX);
  const windowMs = parsePositiveInt(env.CMMS_KV_RATE_LIMIT_WINDOW_MS, DEFAULT_KV_RATE_LIMIT_WINDOW_MS);
  const identity = rateLimitIdentity(req, auth);
  const bucket = KV_RATE_BUCKETS.get(identity);
  if (!bucket || now >= bucket.resetAt) {
    KV_RATE_BUCKETS.set(identity, { count: 1, resetAt: now + windowMs });
    return null;
  }
  bucket.count += 1;
  if (bucket.count <= max) return null;
  return { retryAfterMs: Math.max(bucket.resetAt - now, 1000) };
};

function isTokenAuthorized(req, env) {
  if (env.CMMS_KV_ALLOW_UNAUTHENTICATED === "true") return true;
  const token = env.CMMS_KV_BEARER_TOKEN;
  if (!token) return false;
  return bearerToken(req) === token;
}

async function authorize(req, env, fetchImpl, sessionClient) {
  if (env.CMMS_KV_AUTH === "supabase") {
    const token = bearerToken(req);
    if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };

    // Try CMMS session JWT first (issued for PIN users — worker / cleaner)
    const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
    if (cmmsSecret) {
      const cmmsUser = verifyCmmsSessionToken(token, cmmsSecret);
      if (cmmsUser) return { ok: true, user: cmmsUser };
    }

    // Fall through to Supabase JWT validation (admin / user roles)
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

  return isTokenAuthorized(req, env)
    ? { ok: true }
    : { ok: false, status: 503, error: "storage_auth_not_configured" };
}

const writeAuditEvent = async (auditDriver, event) => {
  if (!auditDriver || !event) return;
  if (typeof auditDriver.write === "function") return auditDriver.write(event);
  if (typeof auditDriver.set === "function") return auditDriver.set(event);
};

const writeAuditEvents = async (auditDriver, events = []) => {
  const cleanEvents = (events || []).filter(Boolean);
  if (!auditDriver || !cleanEvents.length) return;
  if (typeof auditDriver.writeMany === "function") return auditDriver.writeMany(cleanEvents);
  for (const event of cleanEvents) await writeAuditEvent(auditDriver, event);
};

const parseStoredJson = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const ticketStatusEventFromKv = (key, beforeValue, afterValue, actor) => {
  if (!String(key || "").startsWith("ticket:")) return null;
  const before = parseStoredJson(beforeValue);
  const after = parseStoredJson(afterValue);
  const previousStatus = String(before?.status || "");
  const nextStatus = String(after?.status || "");
  if (!previousStatus || !nextStatus || previousStatus === nextStatus) return null;
  return ticketStatusAuditEvent({ ...after, id: after.id || String(key).slice("ticket:".length) }, previousStatus, nextStatus, actor);
};

const restoreBatchWrites = async ({ driver, written = [], shared = false }) => {
  for (const entry of [...written].reverse()) {
    try {
      if (entry.before === null || entry.before === undefined) await driver.delete(entry.key, shared);
      else await driver.set(entry.key, entry.before, shared);
    } catch {}
  }
};

export function createKvApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver
    || (env.CMMS_KV_DRIVER === "upstash" ? createUpstashKvDriverFromEnv(env, fetchImpl) : null)
    || (env.CMMS_KV_DRIVER === "supabase" ? createSupabaseKvDriverFromEnv(env, fetchImpl) : null);
  const backendAuditDriver = auditDriver
    || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function kvApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) {
      return json(res, 503, { error: "storage_backend_not_configured" });
    }
    const rateLimit = checkKvRateLimit(req, auth, env);
    if (rateLimit) {
      res.setHeader("retry-after", String(Math.ceil(rateLimit.retryAfterMs / 1000)));
      return json(res, 429, { error: "rate_limit_exceeded" });
    }

    try {
      const method = String(req.method || "GET").toUpperCase();
      const query = req.query || {};
      const key = Array.isArray(query.key) ? query.key.join("/") : query.key;
      const shared = parseBool(query.shared);

      if (!key && method === "POST") {
        const body = await readBody(req);
        const records = Array.isArray(body?.records) ? body.records : [];
        const writeShared = parseBool(body?.shared ?? shared);
        if (!records.length) return json(res, 400, { error: "records_required" });
        if (records.length > 250) return json(res, 413, { error: "records_limit_exceeded" });
        const normalizedRecords = records.map((record) => ({
          key: String(record?.key || ""),
          value: record?.value ?? ""
        }));
        const badRecord = normalizedRecords.find((record) => kvKeyValidationError(record.key));
        if (badRecord) return json(res, 400, { error: "record_key_invalid", reason: kvKeyValidationError(badRecord.key) });
        if (auth.user) {
          const permissionError = normalizedRecords.map((record) => kvWritePermissionError(auth.user, record.key)).find(Boolean);
          if (permissionError) return json(res, 403, { error: permissionError });
        }
        const atomic = parseBool(body?.atomic);
        const written = [];
        try {
          const recordsWithFlags = normalizedRecords.map((record) => {
            const permissionRule = kvWritePermissionForKey(record.key);
            const shouldAudit = backendAuditDriver && permissionRule && permissionRule.auditSensitive !== false;
            const shouldAuditTicketStatus = backendAuditDriver && String(record.key).startsWith("ticket:");
            return { ...record, shouldAudit, shouldAuditTicketStatus };
          });
          const canUseBulkSet = typeof backendDriver.setMany === "function";
          const shouldPrefetchForRollback = atomic && !canUseBulkSet;
          const recordsNeedingBefore = recordsWithFlags.filter((record) => (
            shouldPrefetchForRollback
              || record.shouldAuditTicketStatus
              || (record.shouldAudit && (!atomic || !canUseBulkSet))
          ));
          const beforeByKey = new Map();
          if (recordsNeedingBefore.length && typeof backendDriver.getMany === "function") {
            const beforeRows = await backendDriver.getMany(recordsNeedingBefore.map((record) => record.key), writeShared);
            for (const row of beforeRows || []) beforeByKey.set(row.key, row.value);
          } else {
            await Promise.all(recordsNeedingBefore.map(async (record) => {
              beforeByKey.set(record.key, await backendDriver.get?.(record.key, writeShared));
            }));
          }
          const keysNeedingBefore = new Set(recordsNeedingBefore.map((record) => record.key));
          const recordsWithBefore = recordsWithFlags.map((record) => ({
            ...record,
            before: keysNeedingBefore.has(record.key) ? beforeByKey.get(record.key) ?? null : null
          }));
          if (canUseBulkSet) {
            await backendDriver.setMany(normalizedRecords, writeShared);
            if (atomic) written.push(...recordsWithBefore.map((record) => ({ key: record.key, before: record.before })));
          } else {
            for (const record of recordsWithBefore) {
              await backendDriver.set(record.key, record.value, writeShared);
              if (atomic) written.push({ key: record.key, before: record.before });
            }
          }
          const auditEvents = [];
          for (const record of recordsWithBefore) {
            auditEvents.push(record.shouldAudit && sensitiveKvWriteAuditEvent({
              key: record.key,
              method,
              actor: auth.user,
              before: record.before,
              after: record.value,
              shared: writeShared
            }));
            auditEvents.push(ticketStatusEventFromKv(record.key, record.before, record.value, auth.user));
          }
          await writeAuditEvents(backendAuditDriver, auditEvents);
        } catch (error) {
          if (atomic) {
            await restoreBatchWrites({ driver: backendDriver, written, shared: writeShared });
            return json(res, 500, { error: "atomic_batch_failed", rolledBack: written.length });
          }
          throw error;
        }
        return json(res, 200, { ok: true, count: normalizedRecords.length, ...(atomic ? { atomic: true } : {}) });
      }

      if (!key && method === "GET") {
        const prefix = String(query.prefix || "");
        if (parseBool(query.includeValues)) {
          const prefixes = parsePrefixes(query.prefixes);
          if (prefixes.length) {
            const invalidPrefix = prefixes.find((item) => kvPrefixValidationError(item));
            if (prefixes.length > 50 || invalidPrefix) return json(res, 400, { error: "prefixes_invalid", reason: invalidPrefix ? kvPrefixValidationError(invalidPrefix) : "too_many_prefixes" });
            const grouped = typeof backendDriver.listValuesMany === "function"
              ? await backendDriver.listValuesMany(prefixes, shared)
              : Object.fromEntries(await Promise.all(prefixes.map(async (item) => [
                item,
                typeof backendDriver.listValues === "function"
                  ? await backendDriver.listValues(item, shared)
                  : await Promise.all((await backendDriver.list(item, shared)).map(async (recordKey) => ({
                    key: recordKey,
                    value: await backendDriver.get(recordKey, shared)
                  })))
              ])));
            const collections = {};
            for (const item of prefixes) {
              collections[item] = (grouped[item] || [])
                .map((record) => ({
                  key: record.key,
                  value: kvReadValueForSession({
                    key: record.key,
                    value: record.value,
                    session: auth.user
                  })
                }))
                .filter((record) => record.key && record.value !== null && record.value !== undefined);
            }
            return json(res, 200, { collections });
          }
          const prefixError = kvPrefixValidationError(prefix);
          if (prefixError) return json(res, 400, { error: "prefix_invalid", reason: prefixError });
          const records = typeof backendDriver.listValues === "function"
            ? await backendDriver.listValues(prefix, shared)
            : await Promise.all((await backendDriver.list(prefix, shared)).map(async (recordKey) => ({
              key: recordKey,
              value: await backendDriver.get(recordKey, shared)
            })));
          const readable = records
            .map((record) => ({
              key: record.key,
              value: kvReadValueForSession({
                key: record.key,
                value: record.value,
                session: auth.user
              })
            }))
            .filter((record) => record.key && record.value !== null && record.value !== undefined);
          return json(res, 200, { records: readable });
        }
        const prefixError = kvPrefixValidationError(prefix);
        if (prefixError) return json(res, 400, { error: "prefix_invalid", reason: prefixError });
        const keys = await backendDriver.list(prefix, shared);
        return json(res, 200, { keys });
      }
      if (!key) return json(res, 400, { error: "key_required" });
      const keyError = kvKeyValidationError(key);
      if (keyError) return json(res, 400, { error: keyError });

      if ((method === "PUT" || method === "DELETE") && auth.user) {
        const permissionError = kvWritePermissionError(auth.user, key);
        if (permissionError) return json(res, 403, { error: permissionError });
      }

      if (method === "GET") {
        const value = kvReadValueForSession({
          key,
          value: await backendDriver.get(key, shared),
          session: auth.user
        });
        return json(res, 200, value === null || value === undefined ? null : { value });
      }
      if (method === "PUT") {
        const body = await readBody(req);
        const value = body?.value ?? "";
        const writeShared = parseBool(body?.shared ?? shared);
        const permissionRule = kvWritePermissionForKey(key);
        const shouldAudit = backendAuditDriver && permissionRule && permissionRule.auditSensitive !== false;
        const shouldAuditTicketStatus = backendAuditDriver && String(key).startsWith("ticket:");
        const before = (shouldAudit || shouldAuditTicketStatus) ? await backendDriver.get?.(key, writeShared) : null;
        await backendDriver.set(key, value, writeShared);
        await writeAuditEvent(backendAuditDriver, shouldAudit && sensitiveKvWriteAuditEvent({
          key,
          method,
          actor: auth.user,
          before,
          after: value,
          shared: writeShared
        }));
        await writeAuditEvent(backendAuditDriver, ticketStatusEventFromKv(key, before, value, auth.user));
        return json(res, 200, { ok: true });
      }
      if (method === "DELETE") {
        const permissionRule = kvWritePermissionForKey(key);
        const shouldAudit = backendAuditDriver && permissionRule && permissionRule.auditSensitive !== false;
        const before = shouldAudit ? await backendDriver.get?.(key, shared) : null;
        await backendDriver.delete(key, shared);
        await writeAuditEvent(backendAuditDriver, shouldAudit && sensitiveKvWriteAuditEvent({
          key,
          method,
          actor: auth.user,
          before,
          shared
        }));
        return json(res, 200, { ok: true });
      }

      res.setHeader("allow", key ? "GET, PUT, DELETE" : "GET");
      return json(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      return sendServerError(req, res, error, { code: "storage_api_error", route: "/api/kv" });
    }
  };
}

export default createKvApiHandler();
