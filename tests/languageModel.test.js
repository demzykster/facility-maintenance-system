import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  languageDirection,
  languageForCode,
  languageOptions,
  normalizeLanguageCode,
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
  });

  it("returns the correct text direction for each supported language", () => {
    expect(languageDirection("he")).toBe("rtl");
    expect(languageDirection("ar")).toBe("rtl");
    expect(languageDirection("en")).toBe("ltr");
    expect(languageDirection("ru")).toBe("ltr");
    expect(languageDirection("hi")).toBe("ltr");
    expect(languageDirection("ti")).toBe("ltr");
  });
});
