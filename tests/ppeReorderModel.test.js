import { describe, expect, it } from "vitest";
import { ppeOpenOrderQty, ppeSmartReorderLines, ppeSmartReorderLinesForItem } from "../src/ppeReorderModel.js";

describe("ppeReorderModel", () => {
  it("counts unreceived quantities from draft and sent orders only", () => {
    const item = { id: "shirt" };
    const orders = [
      { status: "draft", lines: [{ itemId: "shirt", size: "M", qty: 4, received: 1 }] },
      { status: "sent", lines: [{ itemId: "shirt", size: "M", qty: 3, received: 0 }] },
      { status: "received", lines: [{ itemId: "shirt", size: "M", qty: 9, received: 0 }] },
      { status: "draft", lines: [{ itemId: "shirt", size: "L", qty: 2, received: 0 }] }
    ];

    expect(ppeOpenOrderQty(item, "M", orders)).toBe(6);
  });

  it("reorders to max when coverage is below minimum and max is configured", () => {
    const item = {
      id: "shirt",
      name: "חולצה",
      sizes: ["M"],
      stockBySize: { M: 2 },
      minBySize: { M: 5 },
      maxBySize: { M: 10 }
    };

    expect(ppeSmartReorderLinesForItem(item, [])).toEqual([{ size: "M", need: 8 }]);
  });

  it("subtracts already-open order quantities to avoid over-ordering", () => {
    const item = {
      id: "shirt",
      name: "חולצה",
      sizes: ["M"],
      stockBySize: { M: 2 },
      minBySize: { M: 5 },
      maxBySize: { M: 10 }
    };
    const orders = [{ status: "sent", lines: [{ itemId: "shirt", size: "M", qty: 2, received: 0 }] }];

    expect(ppeSmartReorderLinesForItem(item, orders)).toEqual([{ size: "M", need: 6 }]);
  });

  it("does not reorder when stock plus open orders already reaches minimum", () => {
    const item = {
      id: "shirt",
      name: "חולצה",
      sizes: ["M"],
      stockBySize: { M: 4 },
      minBySize: { M: 5 },
      maxBySize: { M: 10 }
    };
    const orders = [{ status: "draft", lines: [{ itemId: "shirt", size: "M", qty: 1, received: 0 }] }];

    expect(ppeSmartReorderLinesForItem(item, orders)).toEqual([]);
  });

  it("builds order lines for active catalog items", () => {
    const lines = ppeSmartReorderLines([
      { id: "shirt", name: "חולצה", sku: "S-1", category: "clothing", sizes: ["M"], stockBySize: { M: 0 }, minBySize: { M: 2 }, maxBySize: { M: 4 } },
      { id: "inactive", name: "ישן", active: false, sizes: ["M"], stockBySize: { M: 0 }, minBySize: { M: 2 } }
    ], []);

    expect(lines).toEqual([{ itemId: "shirt", itemName: "חולצה", sku: "S-1", category: "clothing", size: "M", qty: 4, received: 0 }]);
  });
});
