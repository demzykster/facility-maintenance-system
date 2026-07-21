import { existsSync, statSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const warehouseAsset = new URL("../public/visuals/warehouse-entry.jpg", import.meta.url);

describe("safe visual presentation wiring", () => {
  it("keeps the public entry screen branded from config and separates cleaning scanner from login", () => {
    expect(appSource).toContain("const brandName = brandCompanyName(config)");
    expect(appSource).toContain("const brandSubtitle = brandSiteSubtitle(config)");
    expect(appSource).toContain("<span>{brandName}</span>");
    expect(appSource).toContain("{brandSubtitle && <b>{brandSubtitle}</b>}");
    expect(appSource).toContain("login-card-title");
    expect(appSource).toContain("<div className=\"brand login-title-brand\"><BrandMark logo={config?.brandLogo} /><div className=\"login-card-title\">{t(\"login.title\")}</div></div>");
    expect(appSource).not.toContain("<div className=\"brand-title\">{brandName}</div>");
    expect(appSource).toContain("placeholder={identifierActive || identifier ? \"\" : t(\"login.identity\")}");
    expect(appSource).toContain("aria-label={t(\"login.identity\")}");
    expect(appSource).toContain(".login-input-wrap{display:flex;align-items:center;gap:9px;direction:ltr;");
    expect(appSource).toContain("remember = true");
    expect(appSource).not.toContain("setRemember");
    expect(appSource).not.toContain("checked={remember}");
    expect(appSource).toContain("login-public-panel");
    expect(appSource).toContain("login-toolbar");
    expect(appSource).toContain("<div className=\"login-bg\" dir={languageDirection(language)}>");
    expect(appSource).toContain("language-picker-globe");
    expect(appSource).toContain("language-picker-trigger");
    expect(appSource).toContain("language-picker-menu");
    expect(appSource).toContain("grid-template-areas:\"panel visual\"");
    expect(appSource).not.toContain(".login-bg[dir=\"ltr\"] .login-shell{grid-template-areas:\"panel visual\";}");
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
    expect(appSource).toContain('role="dialog" aria-modal="true" aria-label="סריקת QR של האזור"');
    expect(appSource).toContain('role="alert" aria-live="polite"');
    expect(appSource).toContain(".app-dark .login-shell");
    expect(appSource).toContain("env(safe-area-inset-bottom)");
    expect(appSource).toContain(".tcard:focus-visible");
    expect(appSource).toContain("-webkit-line-clamp:2");
    expect(appSource).toContain("overflow-x:hidden");
  });
});
