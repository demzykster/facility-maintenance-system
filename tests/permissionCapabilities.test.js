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

  it("lets managers request PPE by default and blocks explicit none", () => {
    expect(canRequest({ role: "user" }, "ppe")).toBe(true);
    expect(canRequest({ role: "user", perms: { ppe: "none" } }, "ppe")).toBe(false);
  });

  it("treats user management as a normal permission module", () => {
    const hrManager = { role: "user", perms: { users: "manage" } };
    const basicManager = { role: "user", perms: {} };

    expect(canView(hrManager, "users")).toBe(true);
    expect(canManage(hrManager, "users")).toBe(true);
    expect(canView(basicManager, "users")).toBe(false);
    expect(canManage(basicManager, "users")).toBe(false);
  });

  it("supports management module permissions without role-specific checks", () => {
    const analyst = { role: "user", perms: { analytics: "view", suppliers: "manage", audit: "view" } };
    const supplierViewer = { role: "user", perms: { suppliers: "view" } };

    expect(canView(analyst, "analytics")).toBe(true);
    expect(canManage(analyst, "analytics")).toBe(false);
    expect(canView(analyst, "suppliers")).toBe(true);
    expect(canManage(analyst, "suppliers")).toBe(true);
    expect(canView(supplierViewer, "suppliers")).toBe(true);
    expect(canManage(supplierViewer, "suppliers")).toBe(false);
    expect(canView(analyst, "audit")).toBe(true);
    expect(canManage(analyst, "settings")).toBe(false);
  });
});
