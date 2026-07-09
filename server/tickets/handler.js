import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, normalizeAuditEvent } from "../../src/auditEventModel.js";
import { normalizeTicketRecord } from "../../src/ticketRecordModel.js";
import { sendServerError } from "../httpErrors.js";
import { createSupabaseAuditDriverFromEnv } from "../audit/supabaseAuditDriver.js";
import { bearerToken } from "../session/authCookie.js";
import { buildSessionPayload, createSupabaseSessionClient } from "../session/sessionHandler.js";
import { verifyCmmsSessionToken } from "../session/cmmsSessionToken.js";
import { kvWritePermissionError } from "../kv/permissionPolicy.js";
import { createSupabaseTicketsDriverFromEnv } from "./supabaseTicketsDriver.js";

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

const ticketUpsertAuditEvent = (ticket, actor) => normalizeAuditEvent({
  at: Date.now(),
  actorId: actor.id,
  actorName: actor.name,
  actorRole: actor.role,
  entityType: AUDIT_ENTITY_TYPES.ticket,
  entityId: ticket.id,
  action: AUDIT_ACTIONS.update,
  summary: `Ticket upserted through normalized API: ${ticket.id}`,
  after: { status: ticket.status, track: ticket.track, num: ticket.num },
  metadata: { source: "api/tickets", sourceKvKey: ticket.sourceKvKey }
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

export function createTicketsApiHandler({ driver = null, auditDriver = null, env = process.env, fetchImpl = globalThis.fetch, sessionClient = null } = {}) {
  const backendDriver = driver || createSupabaseTicketsDriverFromEnv(env, fetchImpl);
  const backendAuditDriver = auditDriver || (env.CMMS_AUDIT_DRIVER === "supabase" ? createSupabaseAuditDriverFromEnv(env, fetchImpl) : null);

  return async function ticketsApiHandler(req, res) {
    const auth = await authorize(req, env, fetchImpl, sessionClient);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    if (!backendDriver) return json(res, 503, { error: "tickets_backend_not_configured" });

    try {
      const method = String(req.method || "GET").toUpperCase();
      if (!["POST", "DELETE"].includes(method)) {
        res.setHeader("allow", "POST, DELETE");
        return json(res, 405, { error: "method_not_allowed" });
      }

      const body = await readBody(req);
      if (method === "DELETE") {
        const id = String(req.query?.id || body?.id || body?.ticket?.id || "").trim();
        if (!id) return json(res, 400, { error: "ticket_id_required" });
        const permissionError = kvWritePermissionError(auth.user, `ticket:${id}`);
        if (permissionError) return json(res, 403, { error: permissionError });
        if (typeof backendDriver.delete !== "function") return json(res, 503, { error: "tickets_delete_not_configured" });
        await backendDriver.delete(id);
        await writeAuditEvent(backendAuditDriver, ticketDeleteAuditEvent(id, auth.user));
        return json(res, 200, { ok: true, ticket: { id } });
      }

      const ticket = normalizeTicketRecord(body?.ticket || body);
      const permissionError = kvWritePermissionError(auth.user, `ticket:${ticket.id}`);
      if (permissionError) return json(res, 403, { error: permissionError });

      await backendDriver.upsert(ticket.legacyPayload);
      await writeAuditEvent(backendAuditDriver, ticketUpsertAuditEvent(ticket, auth.user));
      return json(res, 200, { ok: true, ticket: { id: ticket.id, status: ticket.status, sourceKvKey: ticket.sourceKvKey } });
    } catch (error) {
      if (error?.message === "ticket_id_required") return json(res, 400, { error: "ticket_id_required" });
      return sendServerError(req, res, error, { code: "tickets_api_error", route: "/api/tickets" });
    }
  };
}

export default createTicketsApiHandler();
