import { describe, expect, it, vi } from "vitest";
import {
  applyBrandDocumentMetadata,
  brandCompanyName,
  brandShortName,
  brandSiteSubtitle
} from "../src/brandConfigModel.js";

describe("brand config model", () => {
  it("uses default brand text only when no saved site name exists", () => {
    expect(brandCompanyName({})).toBe("עוגן | OGEN");
    expect(brandSiteSubtitle({})).toBe("ניהול אחזקה, צי, ניקיון וביגוד");
  });

  it("keeps an intentionally cleared site name empty", () => {
    expect(brandSiteSubtitle({ siteName: "" })).toBe("");
    expect(brandSiteSubtitle({ siteName: "   " })).toBe("");
  });

  it("trims configured company and site names", () => {
    expect(brandCompanyName({ companyName: "  CDSL  " })).toBe("CDSL");
    expect(brandSiteSubtitle({ siteName: "  מרכז לוגיסטי  " })).toBe("מרכז לוגיסטי");
  });

  it("builds a bounded manifest short name without splitting unicode", () => {
    expect(brandShortName({ companyName: "Ogen | עוגן" })).toBe("Ogen | עוגן");
    expect(Array.from(brandShortName({ companyName: "חברה עם שם ארוך במיוחד למערכת התחזוקה" }))).toHaveLength(24);
  });

  it("updates browser and Apple metadata from one company name", () => {
    const meta = { setAttribute: vi.fn() };
    const manifest = { setAttribute: vi.fn() };
    const favicon = { setAttribute: vi.fn() };
    const appleIcon = { setAttribute: vi.fn() };
    const documentRef = {
      title: "",
      querySelector: vi.fn((selector) => (
        selector === 'meta[name="apple-mobile-web-app-title"]' ? meta
          : selector === 'link[rel="manifest"]' ? manifest
          : selector === 'link[rel="icon"]' ? favicon
          : selector === 'link[rel="apple-touch-icon"]' ? appleIcon
          : null
      ))
    };

    expect(applyBrandDocumentMetadata({ companyName: "  Ogen | עוגן  " }, documentRef)).toBe("Ogen | עוגן");
    expect(documentRef.title).toBe("Ogen | עוגן");
    expect(meta.setAttribute).toHaveBeenCalledWith("content", "Ogen | עוגן");
    expect(manifest.setAttribute).toHaveBeenCalledWith("href", expect.stringMatching(/^\/manifest\.webmanifest\?brand=/));
    expect(favicon.setAttribute).toHaveBeenCalledWith("href", expect.stringMatching(/^\/api\/brand-icon\?brand=/));
    expect(appleIcon.setAttribute).toHaveBeenCalledWith("href", expect.stringMatching(/^\/api\/brand-icon\?brand=/));

    applyBrandDocumentMetadata({ companyName: "Next Brand" }, documentRef);
    expect(documentRef.title).toBe("Next Brand");
    expect(meta.setAttribute).toHaveBeenLastCalledWith("content", "Next Brand");
  });

  it("never leaves browser metadata empty", () => {
    const meta = { setAttribute: vi.fn() };
    const documentRef = {
      title: "",
      querySelector: vi.fn(() => meta)
    };

    applyBrandDocumentMetadata({ companyName: "   " }, documentRef);

    expect(documentRef.title).toBe("עוגן | OGEN");
    expect(meta.setAttribute).toHaveBeenCalledWith("content", "עוגן | OGEN");
  });
});
