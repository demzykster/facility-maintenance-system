import { describe, expect, it } from "vitest";

import {
  supplierCandidatesForTicket,
  supplierHasFacilityCategory,
  supplierTypeFromMeta
} from "../src/ticketSupplierFilterModel.js";

const config = {
  categories: [
    { id: "hvac", label: "מיזוג אוויר" },
    { id: "electrical", label: "חשמל" }
  ],
  suppliers: ["HVAC Co", "Building General", "Electric Co", "Toyota", "PPE Co"],
  supplierMeta: {
    "HVAC Co": { type: "facility", industries: ["facility:hvac"] },
    "Building General": { type: "facility", industries: [] },
    "Electric Co": { type: "facility", industries: ["facility:electrical"] },
    Toyota: { type: "transport", industries: ["transport"] },
    "PPE Co": { type: "goods", industries: ["clothing"] }
  }
};

describe("ticket supplier filtering", () => {
  it("returns only facility suppliers matching the ticket category", () => {
    expect(supplierCandidatesForTicket(config, {
      track: "facility",
      category: "hvac"
    })).toEqual(["HVAC Co", "Building General"]);
  });

  it("keeps the linked transport supplier first without exposing other domains", () => {
    expect(supplierCandidatesForTicket(config, {
      track: "transport",
      forkliftId: "fork-1"
    }, [
      { id: "fork-1", supplier: "Legacy Co" }
    ])).toEqual(["Legacy Co", "Toyota"]);
  });

  it("supports legacy supplier metadata without weakening strict ticket filtering", () => {
    expect(supplierTypeFromMeta({ industries: ["facility:hvac"] }, config)).toBe("facility");
    expect(supplierHasFacilityCategory(config, "HVAC Co", "hvac")).toBe(true);
    expect(supplierHasFacilityCategory(config, "Electric Co", "hvac")).toBe(false);
  });
});
