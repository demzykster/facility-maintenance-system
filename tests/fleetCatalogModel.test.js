import { describe, expect, it } from "vitest";
import {
  catalogAwareTypeMaps,
  cloneVehicleTypeCatalog,
  fleetUnitsMissingFromVehicleCatalog,
  hasSavedVehicleTypeCatalog,
  shouldUseBuiltInVehicleCatalog,
  vehicleCatalogBase,
  vehicleTypeCompactSummary,
  vehicleTypeExistsInConfig,
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

  it("does not merge built-in type maps back into an explicitly saved empty catalog", () => {
    const maps = catalogAwareTypeMaps({
      vehicleTypes: [],
      vehicleTypesSaved: true
    }, {
      forkliftTypes: ["OSE250"],
      typeSla: { OSE250: { high: 4 } },
      typeMeta: { OSE250: { tasrir: true } }
    });

    expect(maps).toEqual({
      forkliftTypes: [],
      typeSla: {},
      typeMeta: {}
    });
  });

  it("keeps legacy default type maps only when no structured catalog was saved", () => {
    const maps = catalogAwareTypeMaps({
      typeMeta: { LPE200: { license: true } }
    }, {
      forkliftTypes: ["OSE250"],
      typeSla: { OSE250: { high: 4 } },
      typeMeta: { OSE250: { tasrir: true } }
    });

    expect(maps.forkliftTypes).toEqual(["OSE250"]);
    expect(maps.typeMeta).toEqual({
      OSE250: { tasrir: true },
      LPE200: { license: true }
    });
  });

  it("does not treat legacy typeMeta as a real type after a structured catalog was saved", () => {
    expect(vehicleTypeExistsInConfig("OSE250", {
      vehicleTypes: [],
      vehicleTypesSaved: true,
      typeMeta: { OSE250: { tasrir: true } }
    })).toBe(false);

    expect(vehicleTypeExistsInConfig("OSE250", {
      vehicleTypes: [],
      typeMeta: { OSE250: { tasrir: true } }
    })).toBe(true);
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

  it("summarizes a vehicle type without mixing its models, docs, and affected units", () => {
    const summary = vehicleTypeCompactSummary({
      name: "מלקטת",
      models: ["OSE250", "LPE200"],
      insurance: true,
      tasrir: true,
      license: false,
      lease: false
    }, [
      { code: "6882002", model: "OSE250", vehicleKind: "מלקטת" },
      { code: "194335", model: "RRE200H", vehicleKind: "מלגזה" }
    ]);

    expect(summary).toEqual({
      modelCount: 2,
      affectedCount: 1,
      affectedCodes: ["6882002"],
      managedDocs: ["ביטוח", "תסקיר"]
    });
  });

  it("uses explicit vehicle type when the same model appears under several types", () => {
    const fleet = [
      { code: "6882002", model: "OSE250", vehicleKind: "מלקטת (כפולה)" },
      { code: "6882003", model: "OSE250", vehicleKind: "מלקטת (סינגל)" },
      { code: "legacy", type: "OSE250" }
    ];

    expect(vehicleTypeInUseCodes({ name: "מלקטת (כפולה)", models: ["OSE250"] }, fleet)).toEqual(["6882002", "legacy"]);
    expect(vehicleTypeInUseCodes({ name: "מלקטת (סינגל)", models: ["OSE250"] }, fleet)).toEqual(["6882003", "legacy"]);
    expect(vehicleTypeInUseCodes({ name: "OSE250", models: ["OSE250"] }, fleet)).toEqual(["6882002", "6882003", "legacy"]);
  });

  it("falls back to the type name when a legacy catalog row has no explicit models", () => {
    expect(vehicleTypeInUseCodes({ name: "פסולתון", models: [] }, [
      { code: "111", type: "פסולתון" },
      { code: "222", type: "OSE250" }
    ])).toEqual(["111"]);
  });

  it("validates imported fleet records by vehicle type and model without mixing the fields", () => {
    const catalog = [
      { name: "מלקטת (כפולה)", models: ["OSE250"] },
      { name: "מלגזת משקל נגדי", models: ["8FBE15T"] }
    ];

    expect(fleetUnitsMissingFromVehicleCatalog([
      { code: "6882002", type: "מלקטת (כפולה)", vehicleKind: "מלקטת (כפולה)", model: "OSE250" },
      { code: "178039", type: "מלגזת משקל נגדי", vehicleKind: "מלגזת משקל נגדי", model: "8FBE15T" }
    ], catalog)).toEqual([]);
  });

  it("still validates legacy fleet records whose type field stores the model code", () => {
    expect(fleetUnitsMissingFromVehicleCatalog([
      { code: "legacy-ok", type: "OSE250" },
      { code: "legacy-missing", type: "RRE200H" }
    ], [
      { name: "מלקטת", models: ["OSE250"] }
    ]).map((unit) => unit.code)).toEqual(["legacy-missing"]);
  });

  it("reports imported fleet records whose explicit vehicle type was removed from the catalog", () => {
    expect(fleetUnitsMissingFromVehicleCatalog([
      { code: "6882002", type: "מלקטת (כפולה)", vehicleKind: "מלקטת (כפולה)", model: "OSE250" },
      { code: "6882003", type: "מלקטת (סינגל)", vehicleKind: "מלקטת (סינגל)", model: "OSE250" }
    ], [
      { name: "מלקטת (כפולה)", models: ["OSE250"] }
    ]).map((unit) => unit.code)).toEqual(["6882003"]);
  });
});
