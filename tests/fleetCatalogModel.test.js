import { describe, expect, it } from "vitest";
import {
  cloneVehicleTypeCatalog,
  hasSavedVehicleTypeCatalog,
  shouldUseBuiltInVehicleCatalog,
  vehicleCatalogBase,
  vehicleTypeInUseCodes,
  vehicleTypeModelCodes
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

  it("detects fleet units that still use a vehicle type before catalog deletion", () => {
    const type = { name: "מלקטת", models: ["OSE250", "LPE200"] };
    expect(vehicleTypeModelCodes(type)).toEqual(["OSE250", "LPE200"]);
    expect(vehicleTypeInUseCodes(type, [
      { code: "6882002", type: "OSE250" },
      { code: "6882003", model: "OSE250" },
      { code: "194335", type: "RRE200H" }
    ])).toEqual(["6882002", "6882003"]);
  });

  it("falls back to the type name when a legacy catalog row has no explicit models", () => {
    expect(vehicleTypeInUseCodes({ name: "פסולתון", models: [] }, [
      { code: "111", type: "פסולתון" },
      { code: "222", type: "OSE250" }
    ])).toEqual(["111"]);
  });
});
