export const DEFAULT_COMPANY_NAME = "CMMS CDSL";
export const DEFAULT_SITE_SUBTITLE = "ניהול אחזקה, צי, ניקיון וביגוד";

const cleanString = (value) => String(value == null ? "" : value).trim();

export const brandCompanyName = (config = {}) => cleanString(config.companyName) || DEFAULT_COMPANY_NAME;

export const brandSiteSubtitle = (config = {}) => {
  if (Object.prototype.hasOwnProperty.call(config, "siteName")) return cleanString(config.siteName);
  return DEFAULT_SITE_SUBTITLE;
};
