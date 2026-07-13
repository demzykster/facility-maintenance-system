import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const fleetAssetsSource = readFileSync(new URL("../src/FleetAssetsModule.jsx", import.meta.url), "utf8");

describe("fleet assets lazy wiring", () => {
  it("keeps fleet and PM screens behind a lazy wrapper", () => {
    expect(appSource).toContain('const FleetAssetsModuleLazy = lazy(() => import("./FleetAssetsModule.jsx")');
    expect(appSource).toContain("<FleetAssetsModuleLazy");
    expect(appSource).toContain("fleetAssetsUi");
    expect(appSource).not.toContain("function FleetModule(");
    expect(appSource).not.toContain("function FleetCard(");
    expect(appSource).not.toContain("function PMModule(");
  });

  it("keeps the transport, import, detail, and PM workflows in the lazy module", () => {
    expect(fleetAssetsSource).toContain("export function FleetAssetsModule(");
    expect(fleetAssetsSource).toContain("function FleetModule(");
    expect(fleetAssetsSource).toContain("function FleetCard(");
    expect(fleetAssetsSource).toContain("function FleetImportWizard(");
    expect(fleetAssetsSource).toContain("function PMModule(");
    expect(fleetAssetsSource).toContain("function PMEntry(");
    expect(fleetAssetsSource).toContain("fleetAiPrompt");
  });
});
