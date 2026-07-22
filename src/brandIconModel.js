export const DEFAULT_BRAND_ICON_HREF = "/api/brand-icon";

const cleanString = (value) => String(value == null ? "" : value).trim();

export function brandIconVersionToken(config = {}) {
  const source = `${cleanString(config.companyName)}|${cleanString(config.siteName)}|${cleanString(config.brandLogo)}`;
  let hash = 5381;
  for (const char of source) hash = ((hash << 5) + hash) ^ char.codePointAt(0);
  return (hash >>> 0).toString(36);
}

export function brandIconHref(config = {}) {
  return `${DEFAULT_BRAND_ICON_HREF}?brand=${brandIconVersionToken(config)}`;
}

export function isSafePublicBrandIconSrc(value) {
  const src = cleanString(value);
  if (!src) return false;
  if (src.startsWith("/api/brand-icon")) return true;
  if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(src)) return true;
  return false;
}

export function publicBrandIconSrcFromManifest(manifest = {}) {
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const match = icons.find((icon) => isSafePublicBrandIconSrc(icon?.src));
  return cleanString(match?.src);
}
