export const DEFAULT_COMPANY_NAME = "עוגן | OGEN";
export const DEFAULT_SITE_SUBTITLE = "ניהול אחזקה, צי, ניקיון וביגוד";
export const MAX_BRAND_SHORT_NAME_LENGTH = 24;

const cleanString = (value) => String(value == null ? "" : value).trim();

export const brandCompanyName = (config = {}) => cleanString(config.companyName) || DEFAULT_COMPANY_NAME;

export const brandShortName = (config = {}) => Array.from(brandCompanyName(config))
  .slice(0, MAX_BRAND_SHORT_NAME_LENGTH)
  .join("")
  .trim() || DEFAULT_COMPANY_NAME;

export const brandSiteSubtitle = (config = {}) => {
  if (Object.prototype.hasOwnProperty.call(config, "siteName")) return cleanString(config.siteName);
  return DEFAULT_SITE_SUBTITLE;
};

const brandVersionToken = (name) => {
  let hash = 5381;
  for (const char of name) hash = ((hash << 5) + hash) ^ char.codePointAt(0);
  return (hash >>> 0).toString(36);
};

export const applyBrandDocumentMetadata = (config = {}, documentRef = globalThis.document) => {
  const companyName = brandCompanyName(config);
  if (!documentRef) return companyName;
  documentRef.title = companyName;

  let appleTitle = documentRef.querySelector?.('meta[name="apple-mobile-web-app-title"]');
  if (!appleTitle && documentRef.createElement && documentRef.head?.appendChild) {
    appleTitle = documentRef.createElement("meta");
    appleTitle.setAttribute("name", "apple-mobile-web-app-title");
    documentRef.head.appendChild(appleTitle);
  }
  appleTitle?.setAttribute?.("content", companyName);

  const manifest = documentRef.querySelector?.('link[rel="manifest"]');
  manifest?.setAttribute?.("href", `/manifest.webmanifest?brand=${brandVersionToken(companyName)}`);
  return companyName;
};
