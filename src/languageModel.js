export const DEFAULT_LANGUAGE = "he";

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: "he", nativeName: "עברית", englishName: "Hebrew", dir: "rtl", base: true },
  { code: "en", nativeName: "English", englishName: "English", dir: "ltr" },
  { code: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr" },
  { code: "ti", nativeName: "ትግርኛ", englishName: "Tigrinya", dir: "ltr" }
]);

const LANGUAGE_BY_CODE = new Map(SUPPORTED_LANGUAGES.map((language) => [language.code, language]));

export function normalizeLanguageCode(value) {
  const code = String(value || "").trim().toLowerCase().replace("_", "-").split("-")[0];
  return LANGUAGE_BY_CODE.has(code) ? code : DEFAULT_LANGUAGE;
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
