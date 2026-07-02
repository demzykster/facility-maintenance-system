const parseJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export function publicComplaintApiUrlFromEnv(env = {}) {
  return String(env?.VITE_CMMS_PUBLIC_COMPLAINT_API_URL || "/api/public/complaints").trim() || "/api/public/complaints";
}

export function publicZonesApiUrlFromEnv(env = {}) {
  return String(env?.VITE_CMMS_PUBLIC_ZONES_API_URL || "/api/public/zones").trim() || "/api/public/zones";
}

export async function fetchPublicZones({ url = "/api/public/zones", fetchImpl = globalThis.fetch } = {}) {
  if (!url || typeof fetchImpl !== "function") return [];
  const response = await fetchImpl(url, { method: "GET" });
  const body = await parseJson(response).catch(() => null);
  if (!response.ok) throw new Error(body?.error || `public_zones_${response.status}`);
  return Array.isArray(body?.zones) ? body.zones : [];
}

export function createPublicComplaintClient({ url = "/api/public/complaints", fetchImpl = globalThis.fetch } = {}) {
  if (!url || typeof fetchImpl !== "function") return null;
  return {
    async submit(payload) {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload || {})
      });
      const body = await parseJson(response).catch(() => null);
      if (!response.ok) throw new Error(body?.error || `public_complaint_${response.status}`);
      return body;
    }
  };
}
