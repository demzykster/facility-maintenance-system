import { describe, expect, it } from "vitest";
import { brandCompanyName, brandSiteSubtitle } from "../src/brandConfigModel.js";

describe("brand config model", () => {
  it("uses default brand text only when no saved site name exists", () => {
    expect(brandCompanyName({})).toBe("CMMS CDSL");
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
});
