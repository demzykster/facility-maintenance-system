import { useEffect } from "react";
import { applyBrandDocumentMetadata, DEFAULT_COMPANY_NAME, DEFAULT_SITE_SUBTITLE } from "./brandConfigModel.js";

const cleanString = (value) => String(value == null ? "" : value).trim();

export function mergePublicBrandConfig(current = {}, manifest = {}) {
  const publicName = cleanString(manifest.name);
  const publicSubtitle = cleanString(manifest.description);
  if (!publicName && !publicSubtitle) return current;
  const currentName = cleanString(current.companyName);
  const currentSubtitle = cleanString(current.siteName);
  const next = { ...current };
  if (publicName && (!currentName || currentName === DEFAULT_COMPANY_NAME)) next.companyName = publicName;
  if (publicSubtitle && (!currentSubtitle || currentSubtitle === DEFAULT_SITE_SUBTITLE)) next.siteName = publicSubtitle;
  if (next.companyName === current.companyName && next.siteName === current.siteName) return current;
  return next;
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
