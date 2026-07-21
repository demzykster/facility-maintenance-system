import { existsSync, statSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const warehouseAsset = new URL("../public/visuals/warehouse-entry.jpg", import.meta.url);

describe("safe visual presentation wiring", () => {
  it("keeps the public entry screen branded from config and separates cleaning scanner from login", () => {
    expect(appSource).toContain("const brandName = brandCompanyName(config)");
    expect(appSource).toContain("<div className=\"brand-title\">{brandName}</div>");
    expect(appSource).toContain("brandSiteSubtitle(config)");
    expect(appSource).toContain("login-public-panel");
    expect(appSource).toContain("login-toolbar");
    expect(appSource).toContain("pub-entry");
    expect(appSource).toContain("onClick={() => setPub(true)}");
    expect(appSource).not.toContain("QR login");
    expect(appSource).not.toContain("כניסה באמצעות QR");
  });

  it("uses a local optimized warehouse asset for the public visual panel", () => {
    expect(appSource).toContain('url("/visuals/warehouse-entry.jpg")');
    expect(existsSync(warehouseAsset)).toBe(true);
    expect(statSync(warehouseAsset).size).toBeGreaterThan(30_000);
    expect(statSync(warehouseAsset).size).toBeLessThan(600_000);
  });

  it("keeps ticket cards driven by semantic rows while preserving SLA and status chips", () => {
    expect(appSource).toContain("ticketListCardSemantics");
    expect(appSource).toContain("semantics.executionRows.map");
    expect(appSource).toContain("semantics.waiting");
    expect(appSource).toContain("semantics.approval");
    expect(appSource).toContain("semantics.sla");
    expect(appSource).toContain("tcard-sla-bar");
    expect(appSource).toContain("tcard-badges");
    expect(appSource).toContain("ticketBlocks(t, config)");
    expect(appSource).toContain("ticketMissedSla(t, config)");
  });

  it("adds presentation-only accessibility and wrapping affordances", () => {
    expect(appSource).toContain("aria-label={`${ticketNo(t)} · ${t.subject || \"קריאה\"}`}");
    expect(appSource).toContain(".tcard:focus-visible");
    expect(appSource).toContain("-webkit-line-clamp:2");
    expect(appSource).toContain("overflow-x:hidden");
  });
});
