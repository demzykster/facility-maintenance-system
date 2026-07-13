import { describe, expect, it } from "vitest";
import { aiStatusErrorLabel, aiStatusSummary } from "../src/AISettingsCard.jsx";

describe("AI settings status labels", () => {
  it("turns server readiness errors into operator-facing setup guidance", () => {
    expect(aiStatusSummary({ serverReady: false, errors: ["ai_server_disabled"] })).toEqual({
      text: "שרת AI כבוי ב-Vercel",
      badge: "כבוי",
      ready: false
    });
    expect(aiStatusSummary({ serverReady: false, errors: ["ai_provider_key_required"] })).toEqual({
      text: "חסר מפתח API ל-AI",
      badge: "חסר מפתח",
      ready: false
    });
    expect(aiStatusSummary({ serverReady: true, errors: [] })).toEqual({
      text: "שרת AI מוכן",
      badge: "מוכן",
      ready: true
    });
  });

  it("keeps the concrete env/key problem visible to admins", () => {
    expect(aiStatusErrorLabel("ai_server_disabled")).toContain("CMMS_AI_MODE=server");
    expect(aiStatusErrorLabel("ai_provider_key_required")).toContain("Vercel env");
    expect(aiStatusErrorLabel("ai_provider_quota_exceeded")).toContain("מכסת ספק ה-AI");
    expect(aiStatusErrorLabel("unknown_error")).toBe("unknown_error");
  });
});
