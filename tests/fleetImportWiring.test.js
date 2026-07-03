import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("fleet import UI wiring", () => {
  it("passes the batch import saver into the fleet module", () => {
    expect(source).toMatch(/const shared = \{[^}]*saveFleetImportBatch[^}]*\}/s);
    expect(source).toMatch(/function FleetModule\(p\) \{\s*const \{[^}]*saveFleetImportBatch[^}]*\} = p;/s);
  });
});
