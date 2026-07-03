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

const toRow = (event = {}) => ({
  id: event.id,
  at: new Date(Number(event.at || Date.now())).toISOString(),
  actor_id: event.actorId || null,
  actor_name: event.actorName || "",
  actor_role: event.actorRole || "",
  entity_type: event.entityType,
  entity_id: event.entityId || "",
  action: event.action,
  summary: event.summary || "",
  before: event.before || {},
  after: event.after || {},
  metadata: event.metadata || {}
});

const fromRow = (row = {}) => ({
  id: row.id || "",
  at: row.at ? Date.parse(row.at) : Date.now(),
  actorId: row.actor_id || "",
  actorName: row.actor_name || "",
  actorRole: row.actor_role || "",
  entityType: row.entity_type || "",
  entityId: row.entity_id || "",
  action: row.action || "",
  summary: row.summary || "",
  before: row.before || {},
  after: row.after || {},
  metadata: row.metadata || {}
});

export function createSupabaseAuditDriver({ url, serviceRoleKey, table = "audit_events", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async write(event) {
      const response = await fetchImpl(base, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
        body: JSON.stringify(toRow(event))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_audit_${response.status}`));
    },
    async writeMany(events = []) {
      const rows = (Array.isArray(events) ? events : []).filter(Boolean).map(toRow);
      if (!rows.length) return;
      const response = await fetchImpl(base, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
        body: JSON.stringify(rows)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_audit_${response.status}`));
    },
    async listClientErrors({ limit = 50 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const query = [
        "select=id,at,actor_id,actor_name,actor_role,entity_type,entity_id,action,summary,metadata",
        "entity_type=eq.system",
        "action=eq.client_error",
        "order=at.desc",
        `limit=${safeLimit}`
      ].join("&");
      const response = await fetchImpl(`${base}?${query}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_audit_list_${response.status}`));
      return Array.isArray(data) ? data.map(fromRow) : [];
    }
  };
}

export function createSupabaseAuditDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseAuditDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_AUDIT_SUPABASE_TABLE || "audit_events",
    fetchImpl
  });
}
