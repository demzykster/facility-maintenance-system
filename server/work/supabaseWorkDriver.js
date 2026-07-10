import {
  maintenanceMeetingRecordFromSupabaseRow,
  maintenanceMeetingRecordToSupabaseRow,
  maintenanceTaskRecordFromSupabaseRow,
  maintenanceTaskRecordToSupabaseRow
} from "../../src/workRecordModel.js";

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

function createSupabaseWorkRecordDriver({ url, serviceRoleKey, table, order, toRow, fromRow, idRequiredError, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !table || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async list({ limit = 1000 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
      const response = await fetchImpl(`${base}?select=*&order=${order}&limit=${safeLimit}`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return Array.isArray(data) ? data.map(fromRow) : [];
    },
    async get(id) {
      const recordId = String(id || "").trim();
      if (!recordId) throw new Error(idRequiredError);
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(recordId)}&select=*&limit=1`, {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return Array.isArray(data) && data[0] ? fromRow(data[0]) : null;
    },
    async upsert(record) {
      const row = toRow(record);
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=representation" }),
        body: JSON.stringify(row)
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
      return Array.isArray(data) ? data[0] : data;
    },
    async delete(id) {
      const recordId = String(id || "").trim();
      if (!recordId) throw new Error(idRequiredError);
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(recordId)}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_${table}_${response.status}`));
    }
  };
}

export function createSupabaseMaintenanceTasksDriver({ url, serviceRoleKey, table = "maintenance_tasks", fetchImpl = globalThis.fetch } = {}) {
  return createSupabaseWorkRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "created_at.desc",
    toRow: maintenanceTaskRecordToSupabaseRow,
    fromRow: maintenanceTaskRecordFromSupabaseRow,
    idRequiredError: "maintenance_task_id_required",
    fetchImpl
  });
}

export function createSupabaseMaintenanceMeetingsDriver({ url, serviceRoleKey, table = "maintenance_meetings", fetchImpl = globalThis.fetch } = {}) {
  return createSupabaseWorkRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "meeting_at.desc",
    toRow: maintenanceMeetingRecordToSupabaseRow,
    fromRow: maintenanceMeetingRecordFromSupabaseRow,
    idRequiredError: "maintenance_meeting_id_required",
    fetchImpl
  });
}

export function createSupabaseWorkDriversFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const options = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl };
  return {
    tasks: createSupabaseMaintenanceTasksDriver({ ...options, table: env.CMMS_MAINTENANCE_TASKS_SUPABASE_TABLE || "maintenance_tasks" }),
    meetings: createSupabaseMaintenanceMeetingsDriver({ ...options, table: env.CMMS_MAINTENANCE_MEETINGS_SUPABASE_TABLE || "maintenance_meetings" })
  };
}
