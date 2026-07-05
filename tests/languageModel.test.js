import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  languageCookieString,
  languageDirection,
  languageForCode,
  languageFromCookie,
  languageFromNavigator,
  languageOptions,
  normalizeLanguageCode,
  preferredInitialLanguage,
  supportedLanguageCode,
  SUPPORTED_LANGUAGES
} from "../src/languageModel.js";

describe("languageModel", () => {
  it("keeps Hebrew as the base and fallback language", () => {
    expect(DEFAULT_LANGUAGE).toBe("he");
    expect(languageForCode("unknown")).toMatchObject({ code: "he", base: true });
    expect(normalizeLanguageCode("")).toBe("he");
  });

  it("declares the agreed worker-facing language set", () => {
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toEqual(["he", "en", "ru", "ar", "hi", "ti"]);
    expect(languageOptions().map((language) => language.nativeName)).toEqual([
      "עברית",
      "English",
      "Русский",
      "العربية",
      "हिन्दी",
      "ትግርኛ"
    ]);
  });

  it("normalizes locale variants without accepting unsupported languages", () => {
    expect(normalizeLanguageCode("HE-il")).toBe("he");
    expect(normalizeLanguageCode("ru-RU")).toBe("ru");
    expect(normalizeLanguageCode("ar_IL")).toBe("ar");
    expect(normalizeLanguageCode("hi-IN")).toBe("hi");
    expect(normalizeLanguageCode("ti-ER")).toBe("ti");
    expect(normalizeLanguageCode("am")).toBe("he");
    expect(supportedLanguageCode("am")).toBe("");
  });

  it("returns the correct text direction for each supported language", () => {
    expect(languageDirection("he")).toBe("rtl");
    expect(languageDirection("ar")).toBe("rtl");
    expect(languageDirection("en")).toBe("ltr");
    expect(languageDirection("ru")).toBe("ltr");
    expect(languageDirection("hi")).toBe("ltr");
    expect(languageDirection("ti")).toBe("ltr");
  });

  it("uses the first supported browser language instead of falling back on the first unsupported locale", () => {
    expect(languageFromNavigator({ languages: ["fr-FR", "ru-RU"], language: "en-US" })).toBe("ru");
    expect(languageFromNavigator({ languages: ["fr-FR"], language: "de-DE" })).toBe("he");
  });

  it("stores and reads the explicit language override from a cookie", () => {
    expect(languageCookieString("ru")).toContain("cmms_language=ru");
    expect(languageCookieString("ru")).toContain("SameSite=Lax");
    expect(languageFromCookie("theme=dark; cmms_language=ar; other=1")).toBe("ar");
    expect(languageFromCookie("cmms_language=fr")).toBe("");
  });

  it("prefers cookie override, then saved language, then browser language", () => {
    expect(preferredInitialLanguage({
      cookie: "cmms_language=hi",
      storedLanguage: "ru",
      navigator: { languages: ["en-US"] }
    })).toBe("hi");
    expect(preferredInitialLanguage({
      cookie: "",
      storedLanguage: "ru",
      navigator: { languages: ["en-US"] }
    })).toBe("ru");
    expect(preferredInitialLanguage({
      cookie: "",
      storedLanguage: "",
      navigator: { languages: ["fr-FR", "en-US"] }
    })).toBe("en");
  });
});
