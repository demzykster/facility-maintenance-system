import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const settingsPanelSource = readFileSync(new URL("../src/SettingsPanel.jsx", import.meta.url), "utf8");

describe("settings and team panel lazy wiring", () => {
  it("keeps settings behind a lazy wrapper", () => {
    expect(appSource).toContain('const SettingsPanelLazy = lazy(() => import("./SettingsPanel.jsx")');
    expect(appSource).toContain("<SettingsPanelLazy");
    expect(appSource).toContain("settingsPanelUi");
    expect(appSource).not.toContain("function UserTree(");
  });

  it("keeps settings and team workflows in the lazy module", () => {
    expect(settingsPanelSource).toContain("export function SettingsPanel(");
    expect(settingsPanelSource).toContain("function UserTree(");
    expect(settingsPanelSource).toContain("const SLA3 =");
    expect(settingsPanelSource).toContain("גיבוי ושחזור");
  });
});
