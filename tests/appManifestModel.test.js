import { describe, expect, it } from "vitest";
import { buildAppManifest } from "../src/appManifestModel.js";

describe("app manifest model", () => {
  it("uses the configured company name while preserving the PWA contract", () => {
    const manifest = buildAppManifest({ companyName: "  Ogen | עוגן  " });

    expect(manifest).toMatchObject({
      name: "Ogen | עוגן",
      short_name: "Ogen | עוגן",
      start_url: "/",
      scope: "/",
      display: "standalone",
      dir: "rtl",
      lang: "he"
    });
    expect(manifest.icons).toHaveLength(5);
  });

  it("uses the centralized fallback for empty company names", () => {
    expect(buildAppManifest({ companyName: "" })).toMatchObject({
      name: "CMMS CDSL",
      short_name: "CMMS CDSL"
    });
  });
});
