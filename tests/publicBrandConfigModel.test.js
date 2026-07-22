import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fetchPublicBrandManifest, mergePublicBrandConfig } from "../src/publicBrandConfigModel.js";

const publicBrandSource = readFileSync(new URL("../src/publicBrandConfigModel.js", import.meta.url), "utf8");

describe("public brand config model", () => {
  it("hydrates the default login brand from the public manifest", () => {
    expect(mergePublicBrandConfig(
      { companyName: "עוגן | OGEN", siteName: "ניהול אחזקה, צי, ניקיון וביגוד", brandLogo: "" },
      { name: "מערכת עוגן", description: "תפעול אחזקה וניהול", icons: [{ src: "/api/brand-icon?brand=abc" }] }
    )).toEqual({ companyName: "מערכת עוגן", siteName: "תפעול אחזקה וניהול", brandLogo: "/api/brand-icon?brand=abc" });
  });

  it("does not overwrite a custom config that loaded first", () => {
    const current = { companyName: "Local Brand", siteName: "Local Site" };
    expect(mergePublicBrandConfig(current, { name: "Remote Brand", description: "Remote Subtitle" })).toBe(current);
  });

  it("reads the public manifest without credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: "עוגן | OGEN", short_name: "עוגן | OGEN", description: "ניהול אחזקה", icons: [{ src: "/api/brand-icon" }] })
    });

    await expect(fetchPublicBrandManifest({ fetchImpl })).resolves.toEqual({
      name: "עוגן | OGEN",
      short_name: "עוגן | OGEN",
      description: "ניהול אחזקה",
      icons: [{ src: "/api/brand-icon" }]
    });
    expect(fetchImpl).toHaveBeenCalledWith("/manifest.webmanifest", {
      cache: "no-store",
      credentials: "omit"
    });
  });

  it("tracks public brand readiness so the login hero does not flash fallback subtitle", () => {
    expect(publicBrandSource).toContain("const [publicBrandChecked, setPublicBrandChecked] = useState(false)");
    expect(publicBrandSource).toContain(".finally(() => { if (active) setPublicBrandChecked(true); })");
    expect(publicBrandSource).toContain("return publicBrandChecked");
    expect(publicBrandSource).toContain("[config.companyName, config.siteName, config.brandLogo]");
  });
});
