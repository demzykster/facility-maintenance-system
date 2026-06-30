import { describe, expect, it } from "vitest";
import {
  cloneVehicleTypeCatalog,
  hasSavedVehicleTypeCatalog,
  shouldUseBuiltInVehicleCatalog,
  vehicleCatalogBase
} from "../src/fleetCatalogModel.js";

describe("fleetCatalogModel", () => {
  it("treats only saved vehicleTypes as a saved catalog", () => {
    expect(hasSavedVehicleTypeCatalog({ vehicleTypes: [] })).toBe(false);
    expect(hasSavedVehicleTypeCatalog({ vehicleTypes: [], vehicleTypesSaved: true })).toBe(true);
    expect(hasSavedVehicleTypeCatalog({ forkliftTypes: ["OSE250"] })).toBe(false);
    expect(hasSavedVehicleTypeCatalog({ vehicleTypes: [{ name: "מלגזה" }] })).toBe(true);
  });

  it("does not show built-in forklift type defaults as real production data in an empty database", () => {
    expect(shouldUseBuiltInVehicleCatalog({
      productionStartsEmpty: true,
      hasSavedCatalog: false,
      fleetCount: 0
    })).toBe(false);
  });

  it("keeps built-in catalog fallback for demo/test or when fleet records already exist", () => {
    expect(shouldUseBuiltInVehicleCatalog({
      productionStartsEmpty: false,
      hasSavedCatalog: false,
      fleetCount: 0
    })).toBe(true);
    expect(shouldUseBuiltInVehicleCatalog({
      productionStartsEmpty: true,
      hasSavedCatalog: false,
      fleetCount: 3
    })).toBe(true);
  });

  it("starts production import catalog additions from an empty base when no fleet/catalog exists", () => {
    const built = vehicleCatalogBase({
      config: { forkliftTypes: ["OSE250"] },
      fleet: [],
      productionStartsEmpty: true,
      buildVehicleTypes: () => [{ name: "default", models: ["OSE250"] }]
    });

    expect(built).toEqual([]);
  });

  it("respects an explicitly saved empty catalog instead of rebuilding from fleet or legacy defaults", () => {
    const built = vehicleCatalogBase({
      config: { vehicleTypes: [], vehicleTypesSaved: true, forkliftTypes: ["OSE250"] },
      fleet: [{ id: "f1", type: "OSE250" }],
      productionStartsEmpty: false,
      buildVehicleTypes: () => [{ name: "default", models: ["OSE250"] }]
    });

    expect(built).toEqual([]);
  });

  it("clones saved catalog models before editing", () => {
    const source = [{ name: "מלגזה", models: ["OSE250"] }];
    const cloned = cloneVehicleTypeCatalog(source);

    cloned[0].models.push("RRE200H");

    expect(source[0].models).toEqual(["OSE250"]);
  });
});
