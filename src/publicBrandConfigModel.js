import { useEffect } from "react";
import { applyBrandDocumentMetadata, DEFAULT_COMPANY_NAME } from "./brandConfigModel.js";

const cleanString = (value) => String(value == null ? "" : value).trim();

export function mergePublicBrandConfig(current = {}, manifest = {}) {
  const publicName = cleanString(manifest.name);
  if (!publicName) return current;
  const currentName = cleanString(current.companyName);
  if (currentName && currentName !== DEFAULT_COMPANY_NAME) return current;
  return { ...current, companyName: publicName };
}

export async function fetchPublicBrandManifest({
  fetchImpl = globalThis.fetch,
  url = "/manifest.webmanifest"
} = {}) {
  if (!fetchImpl) throw new Error("public_brand_fetch_unavailable");
  const response = await fetchImpl(url, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`public_brand_fetch_${response.status}`);
  return response.json();
}

export function useSiteBranding(config, setConfig) {
  useEffect(() => { applyBrandDocumentMetadata(config); }, [config.companyName]);
  useEffect(() => {
    let active = true;
    fetchPublicBrandManifest()
      .then((manifest) => { if (active) setConfig((current) => mergePublicBrandConfig(current, manifest)); })
      .catch(() => {});
    return () => { active = false; };
  }, [setConfig]);
}
