import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("../src/PpeOrders.jsx", import.meta.url), "utf8");

describe("PPE order UI lazy wiring", () => {
  it("keeps PPE order draft and detail UI behind lazy wrappers", () => {
    expect(appSource).toContain('const PpeOrderFormLazy = lazy(() => import("./PpeOrders.jsx")');
    expect(appSource).toContain('const PpeOrdersLazy = lazy(() => import("./PpeOrders.jsx")');
    expect(appSource).toContain("<PpeOrderFormLazy");
    expect(appSource).toContain("<PpeOrdersLazy");
    expect(appSource).not.toContain("function PpeOrderCard(");
    expect(appSource).not.toContain("const PPE_ORDER_ST");
  });

  it("keeps purchase order save/export logic in the lazy order module", () => {
    expect(ordersSource).toContain("export function PpeOrderForm(");
    expect(ordersSource).toContain("export function PpeOrders(");
    expect(ordersSource).toContain("הורדת קובץ הזמנה לספק");
  });
});
