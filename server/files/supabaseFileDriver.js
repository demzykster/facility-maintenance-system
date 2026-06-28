const pathPart = (value) => String(value).split("/").map(encodeURIComponent).join("/");

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
  ...extra
});

const errorMessage = (data, fallback) => data?.message || data?.details || data?.hint || data?.code || data?.error || fallback;

export function createSupabaseFileDriver({ url, serviceRoleKey, bucket, fetchImpl = globalThis.fetch } = {}) {
  if (!url || !serviceRoleKey || !bucket || !fetchImpl) return null;
  const root = String(url).replace(/\/+$/, "");
  const bucketPath = pathPart(bucket);
  const objectUrl = (path) => `${root}/storage/v1/object/${bucketPath}/${pathPart(path)}`;

  return {
    async upload(path, buffer, contentType = "application/octet-stream") {
      const response = await fetchImpl(objectUrl(path), {
        method: "POST",
        headers: serviceHeaders(serviceRoleKey, {
          "content-type": contentType,
          "x-upsert": "true"
        }),
        body: buffer
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_file_upload_${response.status}`));
      return { path, bucket };
    },
    async download(path) {
      const response = await fetchImpl(objectUrl(path), {
        method: "GET",
        headers: serviceHeaders(serviceRoleKey)
      });
      if (!response.ok) {
        const data = await readJsonOrText(response);
        throw new Error(errorMessage(data, `supabase_file_download_${response.status}`));
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        contentType: response.headers?.get?.("content-type") || "application/octet-stream",
        buffer: Buffer.from(arrayBuffer)
      };
    },
    async delete(path) {
      const response = await fetchImpl(`${root}/storage/v1/object/${bucketPath}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceRoleKey, { "content-type": "application/json" }),
        body: JSON.stringify({ prefixes: [path] })
      });
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(errorMessage(data, `supabase_file_delete_${response.status}`));
      return { path, bucket };
    }
  };
}

export function createSupabaseFileDriverFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  return createSupabaseFileDriver({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.CMMS_FILE_BUCKET,
    fetchImpl
  });
}
