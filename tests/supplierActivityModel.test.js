import { describe, expect, it } from "vitest";
import { supplierActivityCounts } from "../src/supplierActivityModel.js";

describe("supplierActivityModel", () => {
  it("counts linked supplier activity across orders and fleet units", () => {
    const counts = supplierActivityCounts({
      supplier: "קידמה",
      orders: [
        { id: "o1", supplier: "קידמה" },
        { id: "o2", supplier: "אחר" }
      ],
      fleet: [
        { id: "f1", supplier: "קידמה" },
        { id: "f2", supplier: "קידמה" },
        { id: "f3", supplier: "" }
      ],
      contacts: [{ id: "c1" }]
    });

    expect(counts).toEqual({ orders: 1, fleet: 2, contacts: 1, linked: 3 });
  });

  it("returns zero counts when supplier is missing", () => {
    expect(supplierActivityCounts({ supplier: "", orders: [{ supplier: "" }], fleet: [{ supplier: "" }] })).toEqual({
      orders: 0,
      fleet: 0,
      contacts: 0,
      linked: 0
    });
  });
});
