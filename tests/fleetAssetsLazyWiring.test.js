import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const fleetAssetsSource = readFileSync(new URL("../src/FleetAssetsModule.jsx", import.meta.url), "utf8");
const fleetAssetsUiSource = appSource.match(/function fleetAssetsUi\(\) \{[\s\S]*?\n\}/)?.[0] || "";

function lazyUiIconProps(source) {
  return [...new Set([...source.matchAll(/Icon=\{([A-Z][A-Za-z0-9_]*)\}/g)].map(([, icon]) => icon))].sort();
}

describe("fleet assets lazy wiring", () => {
  it("keeps fleet and PM screens behind a lazy wrapper", () => {
    expect(appSource).toContain('const FleetAssetsModuleLazy = lazy(() => import("./FleetAssetsModule.jsx")');
    expect(appSource).toContain("<FleetAssetsModuleLazy");
    expect(appSource).toContain("fleetAssetsUi");
    expect(appSource).not.toContain("function FleetModule(");
    expect(appSource).not.toContain("function FleetCard(");
    expect(appSource).not.toContain("<FleetCard");
    expect(appSource).not.toContain("function PMModule(");
  });

  it("keeps the transport, import, detail, and PM workflows in the lazy module", () => {
    expect(fleetAssetsSource).toContain("export function FleetAssetsModule(");
    expect(fleetAssetsSource).toContain("export function FleetAssetCard(");
    expect(fleetAssetsSource).toContain("function FleetModule(");
    expect(fleetAssetsSource).toContain("function FleetCard(");
    expect(fleetAssetsSource).toContain("function FleetImportWizard(");
    expect(fleetAssetsSource).toContain("function PMModule(");
    expect(fleetAssetsSource).toContain("function PMEntry(");
    expect(fleetAssetsSource).toContain("fleetAiPrompt");
  });

  it("keeps the shared unit picker available to both the shell ticket forms and the lazy fleet module", () => {
    expect(appSource).toContain('import { UnitPicker } from "./UnitPicker.jsx";');
    expect(appSource).toContain("function unitPickerUi()");
    expect((appSource.match(/<UnitPicker\b/g) || []).length).toBe(2);
    expect((appSource.match(/ui=\{unitPickerUi\(\)\}/g) || []).length).toBe(2);
    expect(appSource).not.toContain("function UnitPicker(");

    expect(fleetAssetsSource).toContain('import { UnitPicker } from "./UnitPicker.jsx";');
    expect(fleetAssetsSource).toContain("function unitPickerUi()");
    expect(fleetAssetsSource).toContain("ui={unitPickerUi()}");
    expect(fleetAssetsSource).not.toContain("function UnitPicker(");
  });

  it("keeps PM visibility helpers available to shell role views after fleet extraction", () => {
    expect(appSource).toContain("pmVisibleForSession as pmVisible");
    expect(appSource).toContain("pmFleet");
    expect(fleetAssetsSource).toContain('import { pmFleet } from "./ticketVisibilityModel.js";');
    expect(appSource).toMatch(/const myPm = useMemo\(\(\) => pmVisible\(session, pm, fleet\)/);
    expect(appSource).toMatch(/const myPm = useMemo\(\(\) => pmVisible\(session, p\.pm, fleet\)/);
  });

  it("passes lazy module Icon prop dependencies through fleetAssetsUi", () => {
    for (const icon of lazyUiIconProps(fleetAssetsSource)) {
      expect(fleetAssetsSource).toContain(`let ${icon};`);
      expect(fleetAssetsUiSource).toMatch(new RegExp(`\\b${icon}\\b`));
    }
  });

  it("passes PM scheduler helper dependencies through fleetAssetsUi", () => {
    for (const helper of ["clampPmDailyCapacity", "pmFreqForUnit"]) {
      expect(fleetAssetsSource).toContain(`let ${helper};`);
      expect(fleetAssetsUiSource).toMatch(new RegExp(`\\b${helper}\\b`));
    }
  });
});
