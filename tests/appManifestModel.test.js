import { describe, expect, it } from "vitest";
import { buildAppManifest } from "../src/appManifestModel.js";

describe("app manifest model", () => {
  it("uses the configured company name while preserving the PWA contract", () => {
    const manifest = buildAppManifest({ companyName: "  Ogen | עוגן  ", siteName: " תפעול אחזקה וניהול " });

    expect(manifest).toMatchObject({
      name: "Ogen | עוגן",
      short_name: "Ogen | עוגן",
      start_url: "/",
      scope: "/",
      display: "standalone",
      dir: "rtl",
      lang: "he",
      description: "תפעול אחזקה וניהול"
    });
    expect(manifest.icons).toHaveLength(4);
    expect(manifest.icons.every((icon) => icon.src.startsWith("/api/brand-icon?brand="))).toBe(true);
  });

  it("uses the centralized fallback for empty company names", () => {
    expect(buildAppManifest({ companyName: "" })).toMatchObject({
      name: "עוגן | OGEN",
      short_name: "עוגן | OGEN"
    });
  });
});
