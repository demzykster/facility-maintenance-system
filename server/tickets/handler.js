import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizeTicketRecord } from "../../src/ticketRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { createSupabaseTicketsDriverFromEnv } from "./supabaseTicketsDriver.js";
import { createSupabaseFileMetadataDriverFromEnv } from "../files/supabaseFileMetadataDriver.js";
import { createSupabaseFileDriverFromEnv } from "../files/supabaseFileDriver.js";
import { createTicketRecord, mergeTicketUpdateWithExisting } from "./ticketCreateDomain.js";
import { ticketServerCreateV2Enabled } from "../../src/ticketServerCreateCutoverModel.js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req?.[Symbol.asyncIterator] !== "function") return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
};

async function authorize(req, env, fetchImpl, sessionClient) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "supabase_access_token_required" };

  const cmmsSecret = String(env.CMMS_SESSION_SECRET || "").trim();
  if (cmmsSecret) {
    const cmmsUser = verifyCmmsSessionToken(token, cmmsSecret);
    if (cmmsUser) return { ok: true, user: cmmsUser };
  }

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
};

const ticketWriteAuditEvent = (ticket, actor, action = AUDIT_ACTIONS.update) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.ticket,
  entityId: ticket.id,
  action,
  summary: action === AUDIT_ACTIONS.create
    ? `Ticket created through normalized API: ${ticket.id}`
    : `Ticket updated through normalized API: ${ticket.id}`,
  after: { status: ticket.status, track: ticket.track, num: ticket.num },
  metadata: { source: "api/tickets", sourceKvKey: ticket.sourceKvKey || `ticket:${ticket.id}` }
});

const ticketDeleteAuditEvent = (ticketId, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.ticket,
  entityId: ticketId,
  action: AUDIT_ACTIONS.delete,
  summary: `Ticket deleted through normalized API: ${ticketId}`,
  before: { id: ticketId },
  metadata: { source: "api/tickets", sourceKvKey: `ticket:${ticketId}` }
});

const canReadTickets = (user = {}) => {
  if (!user?.role) return true;
  return ["admin", "executive", "user", "tech", "worker"].includes(user.role);
};

const ticketNumberNamespace = (ticket = {}) => (ticket?.track === "transport" || (!ticket?.track && ticket?.forkliftId)) ? "T" : "F";

const ticketWithLegacyNumber = async (driver, ticket = {}) => {
  if (Number.isFinite(Number(ticket.num))) return ticket;
  if (typeof driver?.list !== "function") throw new Error("tickets_read_not_configured");
  const existingTickets = await driver.list({ limit: 1000 });
  const namespace = ticketNumberNamespace(ticket);
  const max = (existingTickets || [])
    .filter((item) => ticketNumberNamespace(item) === namespace && Number.isFinite(Number(item.num)))
    .reduce((highest, item) => Math.max(highest, Number(item.num)), 0);
  return { ...ticket, num: max + 1 };
};

const isMissingTicketCreateRpcError = (error = {}) => {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return message.includes("cmms_create_ticket") || message.includes("pgrst202") || message.includes("function not found");
};

const withFiles = async (ticket, metadataDriver) => {
  if (!ticket || typeof metadataDriver?.listActiveByOwner !== "function") return ticket;
  const files = await metadataDriver.listActiveByOwner("ticket", ticket.id);
  return { ...ticket, files };
};

const deleteTicketOwnedFiles = async ({ ticketId, fileDriver, metadataDriver }) => {
  const cleanup = { files: 0, metadata: false, errors: 0 };
  if (!ticketId || typeof metadataDriver?.listActiveByOwner !== "function") return cleanup;

  let files = [];
  try {
    files = await metadataDriver.listActiveByOwner("ticket", ticketId);
  } catch {
    cleanup.errors += 1;
  }

  if (typeof fileDriver?.delete === "function") {
    for (const file of files) {
      if (!file?.path) continue;
      try {
        await fileDriver.delete(file.path);
        cleanup.files += 1;
      } catch {
        cleanup.errors += 1;
      }
    }
  }

  if (typeof metadataDriver.markDeletedByOwner === "function") {
    try {
      await metadataDriver.markDeletedByOwner("ticket", ticketId);
      cleanup.metadata = true;
    } catch {
      cleanup.errors += 1;
    }
  }

  return cleanup;
};

export function createTicketsApiHandler({ driver = null, auditDriver = null, metadataDriver = null, fileDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabaseTicketsDriverFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);
  const backendMetadataDriver = metadataDriver || (env.CMMS_FILE_METADATA_DRIVER === "supabase" ? createSupabaseFileMetadataDriverFromEnv(env, fetchImpl) : null);
  const backendFileDriver = fileDriver || (env.CMMS_FILE_DRIVER === "supabase" ? createSupabaseFileDriverFromEnv(env, fetchImpl) : null);

  return async function ticketsApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "tickets_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "GET, POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      if (method === "GET") {
        if (!canReadTickets(auth.user)) return json(res, 403, { error: "permission_required:tickets:view" });
        if (typeof backendDriver.get !== "function" || typeof backendDriver.list !== "function") return json(res, 503, { error: "tickets_read_not_configured" });
        const id = String(req.query?.id || "").trim();
        const includeFiles = req.query?.includeFiles === "1" || req.query?.includeFiles === "true";
        if (id) {
          const ticket = await backendDriver.get(id);
          if (!ticket) return json(res, 404, { error: "ticket_not_found" });
          return json(res, 200, { ok: true, ticket: includeFiles ? await withFiles(ticket, backendMetadataDriver) : ticket });
        }
        const tickets = await backendDriver.list({ limit: req.query?.limit });
        return json(res, 200, { ok: true, tickets });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.ticket?.id || "").trim();
        if (!id) return json(res, 400, { error: "ticket_id_required" });
        const permissionError = kvWritePermissionError(auth.user, `ticket:${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "tickets_delete_not_configured" });
        await backendDriver.delete(id);
        const cleanup = await deleteTicketOwnedFiles({ ticketId: id, fileDriver: backendFileDriver, metadataDriver: backendMetadataDriver });
        await writeAuditEvent(backendAuditDriver, ticketDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, ticket: { id }, cleanup });
      }

      const rawTicket = body?.ticket || body;
      const ticket = normalizeTicketRecord(rawTicket);
      const permissionError = kvWritePermissionError(auth.user, `ticket:${ticket.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      if (typeof backendDriver.get !== "function") return json(res, 503, { error: "tickets_read_not_configured" });
      const existing = await backendDriver.get(ticket.id);
      if (existing) {
        const nextTicket = mergeTicketUpdateWithExisting(ticket.legacyPayload, existing);
        const next = normalizeTicketRecord(nextTicket);
        const stored = await backendDriver.upsert(next.legacyPayload);
        const storedTicket = stored?.legacy_payload ? normalizeTicketRecord(stored.legacy_payload).legacyPayload : next.legacyPayload;
        await writeAuditEvent(backendAuditDriver, ticketWriteAuditEvent(next, auth.user, AUDIT_ACTIONS.update));
        return json(res, 200, {
          ok: true,
          ticket: {
            ...storedTicket,
            id: next.id,
            status: next.status,
            num: next.num,
            ticketNo: nextTicket.ticketNo,
            sourceKvKey: next.sourceKvKey
          },
          action: "updated"
        });
      }

      if (!ticketServerCreateV2Enabled(env)) {
        if (typeof backendDriver.upsert !== "function") return json(res, 503, { error: "tickets_write_not_configured" });
        const legacyTicket = await ticketWithLegacyNumber(backendDriver, ticket.legacyPayload);
        const stored = await backendDriver.upsert(legacyTicket);
        const storedTicket = stored?.legacy_payload ? normalizeTicketRecord(stored.legacy_payload).legacyPayload : legacyTicket;
        const next = normalizeTicketRecord(storedTicket);
        await writeAuditEvent(backendAuditDriver, ticketWriteAuditEvent(next, auth.user, AUDIT_ACTIONS.create));
        return json(res, 200, {
          ok: true,
          ticket: {
            ...storedTicket,
            id: next.id,
            status: next.status,
            num: next.num,
            sourceKvKey: next.sourceKvKey
          },
          action: "created",
          numberingMode: "legacy"
        });
      }
      if (typeof backendDriver.create !== "function") return json(res, 503, { error: "tickets_create_not_configured" });
      const created = await createTicketRecord({
        driver: backendDriver,
        ticket: ticket.legacyPayload,
        actor: auth.user,
        idempotencyKey: req.headers?.["idempotency-key"] || body?.idempotencyKey || body?.idempotency_key
      });
      const createdRecord = normalizeTicketRecord(created.ticket);
      await writeAuditEvent(backendAuditDriver, ticketWriteAuditEvent(createdRecord, auth.user, AUDIT_ACTIONS.create));
      return json(res, 200, {
        ok: true,
        ticket: created.ticket,
        action: created.result.idempotencyStatus === "replayed" ? "replayed" : "created",
        actionResult: created.result
      });
    } catch (error) {
      if (error?.message === "ticket_id_required") return json(res, 400, { error: "ticket_id_required" });
      if (error?.message === "idempotency_conflict") return json(res, 409, { error: "idempotency_conflict" });
      if (error?.message === "tickets_create_not_configured") return json(res, 503, { error: "tickets_create_not_configured" });
      if (isMissingTicketCreateRpcError(error)) return json(res, 503, { error: "ticket_create_rpc_unavailable" });
      if (String(error?.message || "").startsWith("ticket_create_fields_required:")) {
        return json(res, 400, { error: "ticket_create_fields_required", fields: String(error.message).split(":")[1]?.split(",").filter(Boolean) || [] });
      }
      return sendServerError(req, res, error, { code: "tickets_api_error", route: "/api/tickets" });
    }
  };
}

export default createTicketsApiHandler();
