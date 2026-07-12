import { describe, expect, it } from "vitest";
import { supplierActivityCounts } from "../src/supplierActivityModel.js";

describe("supplierActivityModel", () => {
  it("counts linked supplier activity across orders, fleet units, and tickets", () => {
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
      tickets: [
        { id: "t1", supplier: "קידמה" },
        { id: "t2", closure: { costSupplier: "קידמה" } },
        { id: "t3", supplier: "אחר" }
      ],
      contacts: [{ id: "c1" }]
    });

    expect(counts).toEqual({ orders: 1, fleet: 2, tickets: 2, contacts: 1, linked: 5 });
  });

  it("returns zero counts when supplier is missing", () => {
    expect(supplierActivityCounts({ supplier: "", orders: [{ supplier: "" }], fleet: [{ supplier: "" }] })).toEqual({
      orders: 0,
      fleet: 0,
      tickets: 0,
      contacts: 0,
      linked: 0
    });
  });
});
