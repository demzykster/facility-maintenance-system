import { useEffect, useState } from "react";
import { applyBrandDocumentMetadata, DEFAULT_COMPANY_NAME, DEFAULT_SITE_SUBTITLE } from "./brandConfigModel.js";
import { publicBrandIconSrcFromManifest } from "./brandIconModel.js";

const cleanString = (value) => String(value == null ? "" : value).trim();

export function mergePublicBrandConfig(current = {}, manifest = {}) {
  const publicName = cleanString(manifest.name);
  const publicSubtitle = cleanString(manifest.description);
  const publicIcon = publicBrandIconSrcFromManifest(manifest);
  if (!publicName && !publicSubtitle && !publicIcon) return current;
  const currentName = cleanString(current.companyName);
  const currentSubtitle = cleanString(current.siteName);
  const currentIcon = cleanString(current.brandLogo);
  const next = { ...current };
  if (publicName && (!currentName || currentName === DEFAULT_COMPANY_NAME)) next.companyName = publicName;
  if (publicSubtitle && (!currentSubtitle || currentSubtitle === DEFAULT_SITE_SUBTITLE)) next.siteName = publicSubtitle;
  if (publicIcon && !currentIcon) next.brandLogo = publicIcon;
  if (next.companyName === current.companyName && next.siteName === current.siteName && next.brandLogo === current.brandLogo) return current;
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
  const [publicBrandChecked, setPublicBrandChecked] = useState(false);
  useEffect(() => { applyBrandDocumentMetadata(config); }, [config.companyName, config.siteName, config.brandLogo]);
  useEffect(() => {
    let active = true;
    setPublicBrandChecked(false);
    fetchPublicBrandManifest()
      .then((manifest) => { if (active) setConfig((current) => mergePublicBrandConfig(current, manifest)); })
      .catch(() => {})
      .finally(() => { if (active) setPublicBrandChecked(true); });
    return () => { active = false; };
  }, [setConfig]);
  return publicBrandChecked;
}
