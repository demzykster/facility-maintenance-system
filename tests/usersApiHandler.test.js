import { describe, expect, it, vi } from "vitest";
import { appUserPatchFromUserRecord, createUsersApiHandler, userRecordFromAppUserProfile } from "../server/users/handler.js";

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    }
  };
}

async function call(handler, req) {
  const res = createRes();
  await handler({ headers: {}, query: {}, method: "GET", ...req }, res);
  return res;
}

function sessionClientFor(profile = {}) {
  return {
    getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "manager@example.com" }),
    getAppUserProfile: vi.fn().mockResolvedValue({
      id: "manager-1",
      auth_user_id: "auth-user-1",
      role: "user",
      name: "Manager",
      active: true,
      permissions: {},
      must_change_password: false,
      ...profile
    })
  };
}

describe("users API handler", () => {
  it("maps app_users profiles to user-management records with legacy-only fields preserved", () => {
    expect(userRecordFromAppUserProfile({
      id: "app-user-1",
      auth_user_id: "auth-1",
      role: "tech",
      name: "Tech One",
      email: "tech@example.com",
      department: "Ops",
      departments: ["Ops"],
      manager_zones: ["North"],
      tech_scope: "facility",
      supplier: "Vendor",
      permissions: { users: "view" },
      active: true,
      must_change_password: true
    }, {
      id: "legacy-id",
      techCats: ["electric"],
      shiftStart: "07:30"
    })).toEqual(expect.objectContaining({
      id: "app-user-1",
      authUserId: "auth-1",
      appUserId: "app-user-1",
      role: "tech",
      name: "Tech One",
      email: "tech@example.com",
      dept: "Ops",
      depts: ["Ops"],
      mgrZones: ["North"],
      techScope: "facility",
      supplier: "Vendor",
      perms: { users: "view" },
      mustChangePassword: true,
      techCats: ["electric"],
      shiftStart: "07:30"
    }));
  });

  it("maps user records to app_users profile patches without KV-only fields", () => {
    expect(appUserPatchFromUserRecord({
      name: " Manager ",
      role: "user",
      active: true,
      email: "MANAGER@EXAMPLE.COM ",
      phone: " 050-111 ",
      dept: "Ops",
      depts: ["Ops", " Logistics "],
      perms: { users: "manage" },
      mgrZones: ["North", " South "],
      techScope: "facility",
      supplier: "Vendor",
      techCats: ["kv-only"],
      pin: "1234"
    })).toEqual({
      name: "Manager",
      role: "user",
      active: true,
      email: "manager@example.com",
      phone: "050-111",
      department: "Ops",
      departments: ["Ops", "Logistics"],
      permissions: { users: "manage" },
      manager_zones: ["North", "South"],
      tech_scope: "facility",
      supplier: "Vendor"
    });
  });

  it("requires a Supabase or CMMS bearer token", async () => {
    const handler = createUsersApiHandler({ driver: { listValues: vi.fn(), get: vi.fn() } });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "supabase_access_token_required" });
  });

  it("lists users through the explicit user-management seam with secrets redacted for view-only sessions", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify({ id: "worker-1", name: "Worker", pin: "1234", password: "secret", activationStatus: "pending" }) }
      ]),
      get: vi.fn()
    };
    const handler = createUsersApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { users: "view" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer manager-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      users: [{ id: "worker-1", name: "Worker", activationStatus: "pending" }]
    });
    expect(driver.listValues).toHaveBeenCalledWith("user:", true);
  });

  it("lists app_users as the read authority and preserves legacy-only KV records", async () => {
    const driver = {
      get: vi.fn(async (key) => {
        if (key === "user:app-user-1") return JSON.stringify({ id: "app-user-1", authUserId: "auth-1", techCats: ["electric"], pin: "1234" });
        return null;
      }),
      listValues: vi.fn().mockResolvedValue([
        { key: "user:app-user-1", value: JSON.stringify({ id: "app-user-1", authUserId: "auth-1", pin: "1234" }) },
        { key: "user:legacy-worker", value: JSON.stringify({ id: "legacy-worker", name: "Legacy Worker", pin: "5678" }) }
      ])
    };
    const profileClient = {
      listAppUserProfiles: vi.fn().mockResolvedValue([
        { id: "app-user-1", auth_user_id: "auth-1", role: "tech", name: "Tech One", active: true, email: "tech@example.com" }
      ]),
      getAppUserProfileById: vi.fn()
    };
    const handler = createUsersApiHandler({
      driver,
      profileClient,
      sessionClient: sessionClientFor({ permissions: { users: "view" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer manager-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      source: "app_users",
      users: [
        expect.objectContaining({ id: "app-user-1", authUserId: "auth-1", name: "Tech One", techCats: ["electric"] }),
        { id: "legacy-worker", name: "Legacy Worker" }
      ]
    });
    expect(profileClient.listAppUserProfiles).toHaveBeenCalled();
  });

  it("reads a single app_users profile before falling back to KV", async () => {
    const driver = {
      get: vi.fn(async (key) => key === "user:app-user-1" ? JSON.stringify({ id: "app-user-1", authUserId: "auth-1", techCats: ["electric"] }) : null),
      listValues: vi.fn()
    };
    const profileClient = {
      getAppUserProfileById: vi.fn().mockResolvedValue({ id: "app-user-1", auth_user_id: "auth-1", role: "tech", name: "Tech One", active: true }),
      listAppUserProfiles: vi.fn()
    };
    const handler = createUsersApiHandler({
      driver,
      profileClient,
      sessionClient: sessionClientFor({ permissions: { users: "view" } })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer manager-token" },
      query: { id: "app-user-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      source: "app_users",
      user: expect.objectContaining({ id: "app-user-1", authUserId: "auth-1", name: "Tech One", techCats: ["electric"] })
    });
    expect(profileClient.getAppUserProfileById).toHaveBeenCalledWith("app-user-1");
  });

  it("limits ordinary workers to their own user record", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify({ id: "worker-1", name: "Worker One", pin: "1234" }) },
        { key: "user:worker-2", value: JSON.stringify({ id: "worker-2", name: "Worker Two", pin: "5678" }) }
      ]),
      get: vi.fn()
    };
    const handler = createUsersApiHandler({
      driver,
      sessionClient: sessionClientFor({ id: "worker-1", role: "worker", permissions: {} })
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer worker-token" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, users: [{ id: "worker-1", name: "Worker One" }] });
  });

  it("blocks user writes for sessions without users manage permission", async () => {
    const driver = { set: vi.fn() };
    const handler = createUsersApiHandler({
      driver,
      sessionClient: sessionClientFor({ permissions: { users: "view" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { user: { id: "worker-1", name: "Worker" } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:users:manage" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("upserts users for sessions with users manage permission and writes audit", async () => {
    const driver = { set: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createUsersApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { users: "manage" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { user: { id: "worker-1", name: "Worker", role: "worker", pin: "1234" } }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, user: { id: "worker-1", name: "Worker", role: "worker" } });
    expect(driver.set).toHaveBeenCalledWith("user:worker-1", JSON.stringify({ id: "worker-1", name: "Worker", role: "worker", pin: "1234" }), true);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "manager-1",
      entityType: "user",
      entityId: "worker-1",
      action: "update"
    }));
  });

  it("syncs login-capable users to app_users before writing the KV mirror", async () => {
    const order = [];
    const driver = {
      set: vi.fn().mockImplementation(() => {
        order.push("kv");
        return Promise.resolve();
      })
    };
    const profileClient = {
      updateAuthEmail: vi.fn().mockImplementation(() => {
        order.push("auth-email");
        return Promise.resolve();
      }),
      updateAppUserProfile: vi.fn().mockImplementation(() => {
        order.push("app-users");
        return Promise.resolve({ id: "app-1" });
      })
    };
    const handler = createUsersApiHandler({
      driver,
      profileClient,
      sessionClient: sessionClientFor({ permissions: { users: "manage" } })
    });

    const user = { id: "manager-2", authUserId: "auth-2", name: "Manager Two", role: "user", email: "MANAGER2@EXAMPLE.COM", perms: { users: "view" } };
    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { user }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.updateAuthEmail).toHaveBeenCalledWith("auth-2", "manager2@example.com");
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("auth-2", expect.objectContaining({
      name: "Manager Two",
      role: "user",
      email: "manager2@example.com",
      permissions: { users: "view" }
    }));
    expect(driver.set).toHaveBeenCalledWith("user:manager-2", JSON.stringify(user), true);
    expect(order).toEqual(["auth-email", "app-users", "kv"]);
  });

  it("does not write the KV mirror when app_users sync is required but unavailable", async () => {
    const driver = { set: vi.fn() };
    const handler = createUsersApiHandler({
      driver,
      env: {},
      sessionClient: sessionClientFor({ permissions: { users: "manage" } })
    });

    const res = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer manager-token" },
      body: { user: { id: "manager-2", authUserId: "auth-2", name: "Manager Two", role: "user" } }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "users_profile_backend_not_configured" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("deletes users for sessions with users manage permission", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const handler = createUsersApiHandler({
      driver,
      auditDriver,
      sessionClient: sessionClientFor({ permissions: { users: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer manager-token" },
      query: { id: "worker-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, user: { id: "worker-1" } });
    expect(driver.delete).toHaveBeenCalledWith("user:worker-1", true);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "manager-1",
      entityType: "user",
      entityId: "worker-1",
      action: "delete"
    }));
  });

  it("deactivates login-capable app_users before deleting the temporary KV mirror", async () => {
    const order = [];
    const driver = {
      delete: vi.fn().mockImplementation(() => {
        order.push("kv");
        return Promise.resolve();
      })
    };
    const profileClient = {
      getAppUserProfileById: vi.fn().mockResolvedValue({ id: "app-user-1", auth_user_id: "auth-1", active: true }),
      updateAppUserProfile: vi.fn().mockImplementation(() => {
        order.push("app-users");
        return Promise.resolve({ id: "app-user-1", active: false });
      })
    };
    const handler = createUsersApiHandler({
      driver,
      profileClient,
      sessionClient: sessionClientFor({ permissions: { users: "manage" } })
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer manager-token" },
      query: { id: "app-user-1" }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.getAppUserProfileById).toHaveBeenCalledWith("app-user-1");
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("auth-1", { active: false });
    expect(driver.delete).toHaveBeenCalledWith("user:app-user-1", true);
    expect(order).toEqual(["app-users", "kv"]);
  });
});
