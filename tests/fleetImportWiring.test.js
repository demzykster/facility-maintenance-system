import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const fleetAssetsSource = readFileSync(new URL("../src/FleetAssetsModule.jsx", import.meta.url), "utf8");

describe("fleet import UI wiring", () => {
  it("passes the batch import saver into the fleet module", () => {
    expect(appSource).toMatch(/const shared = \{[^}]*saveFleetImportBatch[^}]*\}/s);
    expect(fleetAssetsSource).toMatch(/function FleetModule\(p\) \{\s*const \{[^}]*saveFleetImportBatch[^}]*\} = p;/s);
  });
});
