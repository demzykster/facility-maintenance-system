import { describe, expect, it } from "vitest";
import { isIosDevice, isStandaloneDisplay, pwaInstallPromptMode } from "../src/pwaInstallModel.js";

describe("pwaInstallModel", () => {
  it("detects standalone mode from display media or iOS navigator flag", () => {
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
  });

  it("detects iPhone, iPad, and touch iPad desktop user agents", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "iPhone", 1)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)", "Linux armv8", 5)).toBe(false);
  });

  it("uses browser install prompt when available and hides installed apps", () => {
    expect(pwaInstallPromptMode({ isStandalone: true, beforeInstallPromptEvent: {} })).toBe("hidden");
    expect(pwaInstallPromptMode({ beforeInstallPromptEvent: {}, userAgent: "Desktop Chrome" })).toBe("browser");
    expect(pwaInstallPromptMode({ beforeInstallPromptEvent: {}, userAgent: "iPhone" })).toBe("ios");
    expect(pwaInstallPromptMode({ userAgent: "iPhone" })).toBe("ios");
    expect(pwaInstallPromptMode({ userAgent: "Desktop Chrome" })).toBe("hidden");
  });
});
