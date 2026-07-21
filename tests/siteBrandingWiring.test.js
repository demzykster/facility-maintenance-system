import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const technicalSource = readFileSync(new URL("../src/stagingSmokePreflightModel.js", import.meta.url), "utf8");

describe("site branding wiring", () => {
  it("uses the central brand helper across shell and live metadata", () => {
    expect(appSource).toContain("applyBrandDocumentMetadata(config)");
    expect(appSource).toContain("<TopBar title={brandCompanyName(config)}");
    expect(appSource).toContain("{brandCompanyName(config)} · v{APP_VERSION}");
    expect(appSource).toContain("companyName={brandCompanyName(config)}");
  });

  it("keeps static HTML neutral until runtime config is loaded", () => {
    expect(indexSource).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(indexSource).not.toContain("CMMS CDSL");
  });

  it("preserves technical CMMS identifiers", () => {
    expect(appSource).toContain("__CMMS_BUILD_COMMIT__");
    expect(technicalSource).toContain('"VITE_CMMS_APP_MODE"');
    expect(technicalSource).toContain('"CMMS_KV_DRIVER"');
  });
});
