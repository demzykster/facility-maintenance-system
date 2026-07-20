import { ticketRecordFromSupabaseRow, ticketRecordToSupabaseRow } from "../../src/ticketRecordModel.js";

const readJsonOrText = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const serviceHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
  ...extra
});

const errorMessage = (data, fallback) => data?.message || data?.details || data?.hint || data?.code || data?.error || fallback;

export function createSupabaseTicketsDriver({ url, serviceRoleKey, table = "tickets", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;
  const rpcBase = `${root}/rest/v1/rpc`;

  return {
    async list({ limit = 500 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);
      const response = await fetchImpl(`${base}?select=*&order=created_at.desc&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ticket_${response.status}`));
      return Array.isArray(data) ? data.map(ticketRecordFromSupabaseRow) : [];
    },
    async get(id) {
      const ticketId = String(id || "").trim();
      if (!ticketId) throw new Error("ticket_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(ticketId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ticket_${response.status}`));
      return Array.isArray(data) && data[0] ? ticketRecordFromSupabaseRow(data[0]) : null;
    },
    async upsert(ticket) {
      const row = ticketRecordToSupabaseRow(ticket);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ticket_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async create(ticket, { idempotencyKey = "", requestHash = "", actorId = "" } = {}) {
      const row = ticketRecordToSupabaseRow(ticket);
      const rpcPayload = {
        ...row,
        legacy_payload: {
          ...(row.legacy_payload || {}),
          location: row.location,
          asset_id: row.asset_id
        }
      };
      const response = await fetchImpl(`${rpcBase}/cmms_create_ticket`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey),
        body: JSON.stringify({
          ticket_payload: rpcPayload,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          actor_id: actorId
        })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ticket_create_${response.status}`));
      return data;
    },
    async delete(id) {
      const ticketId = String(id || "").trim();
      if (!ticketId) throw new Error("ticket_id_required");
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(ticketId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_ticket_${response.status}`));
    }
  };
}

export function createSupabaseTicketsDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseTicketsDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_TICKETS_SUPABASE_TABLE || "tickets",
    fetchImpl
  });
}
