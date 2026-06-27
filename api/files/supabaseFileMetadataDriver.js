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

const toRow = (metadata = {}) => ({
  id: metadata.id,
  owner_type: metadata.ownerType,
  owner_id: metadata.ownerId,
  owner_sub_id: metadata.ownerSubId || "",
  kind: metadata.kind,
  path: metadata.path,
  content_type: metadata.contentType,
  storage_provider: metadata.storageProvider,
  bucket: metadata.bucket,
  size_bytes: metadata.sizeBytes || 0,
  created_by_id: metadata.createdById || null,
  created_by_name: metadata.createdByName || "",
  created_by_role: metadata.createdByRole || "",
  created_at: new Date(Number(metadata.createdAt || Date.now())).toISOString(),
  deleted_at: metadata.deletedAt ? new Date(Number(metadata.deletedAt)).toISOString() : null
});

export function createSupabaseFileMetadataDriver({ url, serviceRoleKey, table = "file_metadata", fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const base = `${root}/rest/v1/${encodeURIComponent(table)}`;

  return {
    async upsert(metadata) {
      const response = await fetchImpl(`${base}?on_conflict=id`, {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, { prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(toRow(metadata))
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_file_metadata_${response.status}`));
    },
    async markDeleted(id, deletedAt = Date.now()) {
      const response = await fetchImpl(`${base}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
        body: JSON.stringify({ deleted_at: new Date(Number(deletedAt)).toISOString() })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_file_metadata_delete_${response.status}`));
    },
    async markDeletedByPath(path, deletedAt = Date.now()) {
      const response = await fetchImpl(`${base}?path=eq.${encodeURIComponent(path)}`, {
        method: "PATCH",
        headers: serviceHeaders(serviceRoleKey, { prefer: "return=minimal" }),
        body: JSON.stringify({ deleted_at: new Date(Number(deletedAt)).toISOString() })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_file_metadata_delete_${response.status}`));
    }
  };
}

export function createSupabaseFileMetadataDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseFileMetadataDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.CMMS_FILE_METADATA_SUPABASE_TABLE || "file_metadata",
    fetchImpl
  });
}
