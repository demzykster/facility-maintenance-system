import { describe, expect, it } from "vitest";
import { languageOptions } from "../src/languageModel.js";
import { uiText, uiTextOptions, uiTextOptionsForLanguage } from "../src/uiI18nModel.js";

describe("uiI18nModel", () => {
  it("falls back to Hebrew for unsupported languages and unknown keys", () => {
    expect(uiText("fr", "login.title")).toBe("כניסה למערכת");
    expect(uiText("en", "missing.key")).toBe("missing.key");
  });

  it("keeps every base UI key directly available in every supported language", () => {
    const keys = uiTextOptions();
    const languages = languageOptions().map((language) => language.code);

    expect(keys.length).toBeGreaterThan(0);
    for (const language of languages) {
      expect([...uiTextOptionsForLanguage(language)].sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(uiText(language, key, { zone: "Zone A", count: 2, time: "08:00" })).not.toBe(key);
      }
    }
  });

  it("exposes the worker and cleaner strings used by the localized shell", () => {
    expect(uiText("en", "worker.newReport")).toBe("Problem report");
    expect(uiText("ru", "worker.newReport")).toBe("Сообщить о проблеме");
    expect(uiText("ru", "rolePreview.title")).toBe("Предпросмотр роли");
    expect(uiText("ru", "ppe.noneIssued")).toContain("экипировку");
    expect(uiText("ar", "audit.title")).toBe("سجل النشاط");
    expect(uiText("ru", "cleaner.todoNow", { count: 2 })).toBe("Нужно выполнить сейчас (2)");
    expect(uiText("ar", "public.submit")).toContain("بلاغ");
    expect(uiText("ar", "cleaner.todoNow", { count: 2 })).toContain("2");
    expect(uiText("hi", "push.enable")).toBe("चालू करें");
    expect(uiText("ti", "common.logout")).toBe("ውጻእ");
  });

  it("keeps a stable key list for smoke checks", () => {
    expect(uiTextOptions()).toContain("login.title");
    expect(uiTextOptions()).toContain("public.qrOnly");
    expect(uiTextOptions()).toContain("cleaner.todoNow");
    expect(uiTextOptions()).toContain("cleaner.noAssignedZones");
    expect(uiTextOptions()).toContain("cleaningQr.title");
    expect(uiTextOptions()).toContain("push.title");
    expect(uiTextOptions()).toContain("rolePreview.title");
    expect(uiTextOptions()).toContain("ppe.noneIssued");
    expect(uiTextOptions()).toContain("audit.noMatches");
  });

  it("localizes the cleaning QR gate for Russian cleaner flows", () => {
    expect(uiText("ru", "cleaningQr.title")).toBe("Нужно отсканировать QR в зоне");
    expect(uiText("ru", "cleaningQr.forZone", { zone: "Склад" })).toContain("Склад");
    expect(uiText("ru", "cleaningQr.remoteBlocked")).toContain("удалённо");
  });
});
