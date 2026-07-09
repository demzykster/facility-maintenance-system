import {
  ppeItemRecordFromSupabaseRow,
  ppeItemRecordToSupabaseRow,
  ppeMovementRecordFromSupabaseRow,
  ppeMovementRecordToSupabaseRow,
  ppeNormRecordFromSupabaseRow,
  ppeNormRecordToSupabaseRow,
  ppeOrderRecordFromSupabaseRow,
  ppeOrderRecordToSupabaseRow,
  ppeRequestRecordFromSupabaseRow,
  ppeRequestRecordToSupabaseRow
} from "../../src/ppeRecordModel.js";

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

function createSupabasePpeRecordDriver({ url, serviceRoleKey, table, order, toRow, fromRow, idRequiredError, fetchImpl = globalThis.fetch } = {}) {
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

export function createSupabasePpeMovementsDriver({ url, serviceRoleKey, table = "ppe_movements", fetchImpl = globalThis.fetch } = {}) {
  return createSupabasePpeRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "movement_at.desc",
    toRow: ppeMovementRecordToSupabaseRow,
    fromRow: ppeMovementRecordFromSupabaseRow,
    idRequiredError: "ppe_movement_id_required",
    fetchImpl
  });
}

export function createSupabasePpeItemsDriver({ url, serviceRoleKey, table = "ppe_items", fetchImpl = globalThis.fetch } = {}) {
  return createSupabasePpeRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "name.asc",
    toRow: ppeItemRecordToSupabaseRow,
    fromRow: ppeItemRecordFromSupabaseRow,
    idRequiredError: "ppe_item_id_required",
    fetchImpl
  });
}

export function createSupabasePpeNormsDriver({ url, serviceRoleKey, table = "ppe_norms", fetchImpl = globalThis.fetch } = {}) {
  return createSupabasePpeRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "dept.asc",
    toRow: ppeNormRecordToSupabaseRow,
    fromRow: ppeNormRecordFromSupabaseRow,
    idRequiredError: "ppe_norm_id_required",
    fetchImpl
  });
}

export function createSupabasePpeRequestsDriver({ url, serviceRoleKey, table = "ppe_requests", fetchImpl = globalThis.fetch } = {}) {
  return createSupabasePpeRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "requested_at.desc",
    toRow: ppeRequestRecordToSupabaseRow,
    fromRow: ppeRequestRecordFromSupabaseRow,
    idRequiredError: "ppe_request_id_required",
    fetchImpl
  });
}

export function createSupabasePpeOrdersDriver({ url, serviceRoleKey, table = "ppe_orders", fetchImpl = globalThis.fetch } = {}) {
  return createSupabasePpeRecordDriver({
    url,
    serviceRoleKey,
    table,
    order: "created_at.desc",
    toRow: ppeOrderRecordToSupabaseRow,
    fromRow: ppeOrderRecordFromSupabaseRow,
    idRequiredError: "ppe_order_id_required",
    fetchImpl
  });
}

export function createSupabasePpeDriversFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const options = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl };
  return {
    movements: createSupabasePpeMovementsDriver({ ...options, table: env.CMMS_PPE_MOVEMENTS_SUPABASE_TABLE || "ppe_movements" }),
    items: createSupabasePpeItemsDriver({ ...options, table: env.CMMS_PPE_ITEMS_SUPABASE_TABLE || "ppe_items" }),
    norms: createSupabasePpeNormsDriver({ ...options, table: env.CMMS_PPE_NORMS_SUPABASE_TABLE || "ppe_norms" }),
    requests: createSupabasePpeRequestsDriver({ ...options, table: env.CMMS_PPE_REQUESTS_SUPABASE_TABLE || "ppe_requests" }),
    orders: createSupabasePpeOrdersDriver({ ...options, table: env.CMMS_PPE_ORDERS_SUPABASE_TABLE || "ppe_orders" })
  };
}
