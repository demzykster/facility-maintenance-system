import { describe, expect, it } from "vitest";
import { uiText, uiTextOptions } from "../src/uiI18nModel.js";

describe("uiI18nModel", () => {
  it("falls back to Hebrew for unsupported languages and unknown keys", () => {
    expect(uiText("fr", "login.title")).toBe("כניסה למערכת");
    expect(uiText("en", "missing.key")).toBe("missing.key");
  });

  it("exposes the worker-facing language strings used by the first localized shell", () => {
    expect(uiText("en", "worker.newReport")).toBe("Problem report");
    expect(uiText("ru", "worker.newReport")).toBe("Сообщить о проблеме");
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
    expect(uiTextOptions()).toContain("push.title");
  });
});
