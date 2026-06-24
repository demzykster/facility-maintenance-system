import { describe, expect, it } from "vitest";
import { canFull, canManage, canRequest, canView, hasPermission } from "../src/permissionModel.js";

describe("permission capability helpers", () => {
  it("maps levels to capability checks", () => {
    const manager = { role: "user", perms: { ppe: "manage", fleetDocs: "view", workerAccess: "none" } };

    expect(canView(manager, "ppe")).toBe(true);
    expect(canRequest(manager, "ppe")).toBe(true);
    expect(canManage(manager, "ppe")).toBe(true);
    expect(canFull(manager, "ppe")).toBe(false);

    expect(canView(manager, "fleetDocs")).toBe(true);
    expect(canManage(manager, "fleetDocs")).toBe(false);
    expect(canManage(manager, "workerAccess")).toBe(false);
  });

  it("keeps admin full and missing users at none", () => {
    expect(canFull({ role: "admin" }, "settings")).toBe(true);
    expect(hasPermission(null, "ppe", "view")).toBe(false);
    expect(canView({ role: "worker" }, "ppe")).toBe(false);
  });
});
