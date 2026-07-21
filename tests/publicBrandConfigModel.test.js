import { describe, expect, it, vi } from "vitest";
import { fetchPublicBrandManifest, mergePublicBrandConfig } from "../src/publicBrandConfigModel.js";

describe("public brand config model", () => {
  it("hydrates the default login brand from the public manifest", () => {
    expect(mergePublicBrandConfig(
      { companyName: "עוגן | OGEN", siteName: "ניהול אחזקה" },
      { name: "עוגן | OGEN" }
    )).toEqual({ companyName: "עוגן | OGEN", siteName: "ניהול אחזקה" });
  });

  it("does not overwrite a custom config that loaded first", () => {
    const current = { companyName: "Local Brand", siteName: "Local Site" };
    expect(mergePublicBrandConfig(current, { name: "Remote Brand" })).toBe(current);
  });

  it("reads the public manifest without credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: "עוגן | OGEN", short_name: "עוגן | OGEN" })
    });

    await expect(fetchPublicBrandManifest({ fetchImpl })).resolves.toEqual({
      name: "עוגן | OGEN",
      short_name: "עוגן | OGEN"
    });
    expect(fetchImpl).toHaveBeenCalledWith("/manifest.webmanifest", {
      cache: "no-store",
      credentials: "omit"
    });
  });
});
