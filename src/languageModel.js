export const DEFAULT_LANGUAGE = "he";
export const LANGUAGE_COOKIE_NAME = "cmms_language";

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: "he", nativeName: "עברית", englishName: "Hebrew", dir: "rtl", base: true },
  { code: "en", nativeName: "English", englishName: "English", dir: "ltr" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr" },
  { code: "ti", nativeName: "ትግርኛ", englishName: "Tigrinya", dir: "ltr" }
]);

const LANGUAGE_BY_CODE = new Map(SUPPORTED_LANGUAGES.map((language) => [language.code, language]));

export function supportedLanguageCode(value) {
  const code = String(value || "").trim().toLowerCase().replace("_", "-").split("-")[0];
  return LANGUAGE_BY_CODE.has(code) ? code : "";
}

export function normalizeLanguageCode(value) {
  return supportedLanguageCode(value) || DEFAULT_LANGUAGE;
}

export function languageForCode(value) {
  return LANGUAGE_BY_CODE.get(normalizeLanguageCode(value)) || LANGUAGE_BY_CODE.get(DEFAULT_LANGUAGE);
}

export function languageDirection(value) {
  return languageForCode(value).dir;
}

export function languageOptions() {
  return SUPPORTED_LANGUAGES.map(({ code, nativeName, englishName, dir, base }) => ({
    code,
    nativeName,
    englishName,
    dir,
    base: !!base
  }));
}

export function languageFromNavigator(nav = globalThis.navigator) {
  const candidates = Array.isArray(nav?.languages) && nav.languages.length > 0
    ? nav.languages
    : [nav?.language].filter(Boolean);
  for (const candidate of candidates) {
    const code = supportedLanguageCode(candidate);
    if (code) return code;
  }
  return DEFAULT_LANGUAGE;
}

export function languageFromCookie(cookie = "") {
  const parts = String(cookie || "").split(";");
  for (const part of parts) {
    const [rawName, ...rawValue] = part.split("=");
    if (rawName?.trim() !== LANGUAGE_COOKIE_NAME) continue;
    const value = decodeURIComponent(rawValue.join("=") || "");
    return supportedLanguageCode(value);
  }
  return "";
}

export function languageCookieString(value, { maxAgeSeconds = 60 * 60 * 24 * 365 } = {}) {
  const code = normalizeLanguageCode(value);
  return `${LANGUAGE_COOKIE_NAME}=${encodeURIComponent(code)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export function preferredInitialLanguage({ cookie = "", storedLanguage = "", navigator: nav = globalThis.navigator } = {}) {
  return languageFromCookie(cookie) || supportedLanguageCode(storedLanguage) || languageFromNavigator(nav);
}
