import { DEFAULT_LANGUAGE, languageOptions, normalizeLanguageCode } from "./languageModel.js";

const CLEANING_CHECKLIST_DRAFTS = Object.freeze({
  "שטיפת רצפה": { en: "Floor washing", ru: "Мытье пола", ar: "غسل الأرضية", hi: "फर्श धोना", ti: "ምሕጻብ መሬት" },
  "מילוי סבון": { en: "Refill soap", ru: "Пополнить мыло", ar: "تعبئة الصابون", hi: "साबुन भरना", ti: "ሳሙና ምምላእ" },
  "נייר טואלט": { en: "Toilet paper", ru: "Туалетная бумага", ar: "ورق تواليت", hi: "टॉयलेट पेपर", ti: "ናይ ሽቓቕ ወረቐት" },
  "מגבות נייר": { en: "Paper towels", ru: "Бумажные полотенца", ar: "مناشف ورقية", hi: "पेपर टॉवल", ti: "ናይ ወረቐት መንጸፊ" },
  "פינוי פחים": { en: "Empty bins", ru: "Вынести мусор", ar: "تفريغ السلال", hi: "कूड़ेदान खाली करना", ti: "መጕሓፊ ምፍሳስ" },
  "ריקון פחים": { en: "Empty bins", ru: "Опустошить мусорные баки", ar: "تفريغ السلال", hi: "कूड़ेदान खाली करना", ti: "መጕሓፊ ምፍሳስ" },
  "ניגוב משטחים": { en: "Wipe surfaces", ru: "Протереть поверхности", ar: "مسح الأسطح", hi: "सतह पोंछना", ti: "ገጻት ምድራዝ" },
  "שטיפת רצפה / שבר": { en: "Floor washing / breakage", ru: "Мытье пола / поломка", ar: "غسل الأرضية / كسر", hi: "फर्श धोना / टूट-फूट", ti: "ምሕጻብ መሬት / ስብራት" },
  "כיור": { en: "Sink", ru: "Раковина", ar: "مغسلة", hi: "सिंक", ti: "መሕጸቢ" },
  "שירותים": { en: "Toilets", ru: "Туалеты", ar: "دورات المياه", hi: "शौचालय", ti: "ሽቓቕ" },
});

export function cleaningChecklistTranslationLanguages() {
  return languageOptions().filter((language) => !language.base && language.code !== DEFAULT_LANGUAGE);
}

export function normalizeCleaningChecklistTranslations(translations = {}) {
  const supported = new Set(cleaningChecklistTranslationLanguages().map((language) => language.code));
  const normalized = {};
  Object.entries(translations || {}).forEach(([code, value]) => {
    const language = normalizeLanguageCode(code);
    const text = String(value || "").trim();
    if (supported.has(language) && text) normalized[language] = text;
  });
  return normalized;
}

export function draftCleaningChecklistTranslations(label, existing = {}) {
  const base = String(label || "").trim();
  const drafts = CLEANING_CHECKLIST_DRAFTS[base] || {};
  const current = normalizeCleaningChecklistTranslations(existing);
  const next = { ...current };
  cleaningChecklistTranslationLanguages().forEach((language) => {
    if (!next[language.code] && drafts[language.code]) next[language.code] = drafts[language.code];
  });
  return next;
}

export function normalizeCleaningChecklistItem(item = {}) {
  const translations = normalizeCleaningChecklistTranslations(item.translations);
  const normalized = {
    id: item.id || "",
    label: String(item.label || "").trim(),
  };
  if (Object.keys(translations).length > 0) normalized.translations = translations;
  return normalized;
}
