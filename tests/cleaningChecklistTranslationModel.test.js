import { describe, expect, it } from "vitest";
import {
  draftCleaningChecklistTranslations,
  normalizeCleaningChecklistItem,
  normalizeCleaningChecklistTranslations
} from "../src/cleaningChecklistTranslationModel.js";

describe("cleaning checklist translation model", () => {
  it("generates reviewable drafts for known cleaning checklist labels", () => {
    expect(draftCleaningChecklistTranslations("מילוי סבון")).toMatchObject({
      en: "Refill soap",
      ru: "Пополнить мыло",
      ar: "تعبئة الصابون"
    });
  });

  it("does not overwrite translations that an admin already reviewed", () => {
    expect(draftCleaningChecklistTranslations("מילוי סבון", { en: "Soap refill checked by admin" }).en).toBe("Soap refill checked by admin");
  });

  it("leaves unknown labels untranslated instead of inventing operational text", () => {
    expect(draftCleaningChecklistTranslations("בדיקת משהו מיוחד")).toEqual({});
  });

  it("normalizes saved checklist items by trimming empty translation fields", () => {
    expect(normalizeCleaningChecklistItem({
      id: "x1",
      label: "  מילוי סבון  ",
      translations: { en: " Refill soap ", ru: "", he: "עברית לא נשמרת כתרגום", xx: "ignored" }
    })).toEqual({
      id: "x1",
      label: "מילוי סבון",
      translations: { en: "Refill soap" }
    });
  });

  it("keeps only supported non-base languages", () => {
    expect(normalizeCleaningChecklistTranslations({ en: "A", ru: "B", he: "C", fr: "D" })).toEqual({
      en: "A",
      ru: "B"
    });
  });
});
