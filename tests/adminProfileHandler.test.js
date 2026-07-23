import { describe, expect, it, vi } from "vitest";
import {
  createAdminProfileHandler,
  validateAdminProfilePayload
} from "../server/session/adminProfileHandler.js";

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
  await handler({ headers: {}, method: "PATCH", body: {}, ...req }, res);
  return res;
}

const adminProfile = {
  id: "admin-1",
  auth_user_id: "admin-auth-1",
  role: "admin",
  name: "Owner",
  email: "owner@example.com",
  active: true,
  must_change_password: false
};

describe("admin profile handler", () => {
  it("validates auth user id and patch fields", () => {
    expect(validateAdminProfilePayload({ patch: { active: false } })).toEqual({ ok: false, error: "auth_user_id_required" });
    expect(validateAdminProfilePayload({ authUserId: "auth-1" })).toEqual({ ok: false, error: "profile_patch_required" });
    expect(validateAdminProfilePayload({ authUserId: "auth-1", patch: { email: "bad" } })).toEqual({ ok: false, error: "email_invalid" });
    expect(validateAdminProfilePayload({
      authUserId: "auth-1",
      patch: {
        active: false,
        role: "executive",
        departments: ["נפחי", ""],
        manager_zones: ["z1"],
        permissions: { fleet: "view" }
      }
    })).toEqual({
      ok: true,
      authUserId: "auth-1",
      patch: {
        active: false,
        role: "executive",
        departments: ["נפחי"],
        manager_zones: ["z1"],
        permissions: { fleet: "view" }
      }
    });
  });

  it("does not allow creating or syncing cleaner as a new profile role", () => {
    expect(validateAdminProfilePayload({
      authUserId: "auth-1",
      patch: { role: "cleaner" }
    })).toEqual({ ok: false, error: "role_invalid" });
  });

  it("lets an active admin sync a disabled user profile", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "admin-auth-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue(adminProfile),
      getAppUserProfileByAuthUserId: vi.fn().mockResolvedValue({ id: "target-1", auth_user_id: "target-auth-1", role: "user", active: true }),
      hasOtherActiveAdmin: vi.fn(),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn().mockResolvedValue({
        id: "target-1",
        auth_user_id: "target-auth-1",
        active: false
      })
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer admin-token" },
      body: {
        authUserId: "target-auth-1",
        patch: {
          name: "Manager",
          role: "user",
          active: false,
          departments: ["נפחי"],
          permissions: { tickets: "manage" },
          manager_zones: ["zone-1"],
          tech_scope: "both"
        }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      profile: {
        id: "target-1",
        auth_user_id: "target-auth-1",
        active: false
      }
    });
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("target-auth-1", {
      name: "Manager",
      role: "user",
      active: false,
      departments: ["נפחי"],
      permissions: { tickets: "manage" },
      manager_zones: ["zone-1"],
      tech_scope: "both"
    });
    expect(profileClient.updateAuthEmail).not.toHaveBeenCalled();
  });

  it("prevents disabling the last active admin through admin profile sync", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "admin-auth-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue(adminProfile),
      getAppUserProfileByAuthUserId: vi.fn().mockResolvedValue(adminProfile),
      hasOtherActiveAdmin: vi.fn().mockResolvedValue(false),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn()
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer admin-token" },
      body: { authUserId: "admin-auth-1", patch: { active: false } }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "last_active_admin_required" });
    expect(profileClient.updateAppUserProfile).not.toHaveBeenCalled();
  });

  it("allows disabling an admin when another active admin exists", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "admin-auth-2", email: "second@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({ ...adminProfile, id: "admin-2", auth_user_id: "admin-auth-2", email: "second@example.com" }),
      getAppUserProfileByAuthUserId: vi.fn().mockResolvedValue(adminProfile),
      hasOtherActiveAdmin: vi.fn().mockResolvedValue(true),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn().mockResolvedValue({ ...adminProfile, active: false })
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer second-admin-token" },
      body: { authUserId: "admin-auth-1", patch: { active: false } }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.hasOtherActiveAdmin).toHaveBeenCalledWith({ authUserId: "admin-auth-1", id: "admin-1" });
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("admin-auth-1", { active: false });
  });

  it("rejects a non-admin caller", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "user-auth-1", email: "user@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "user-1",
        auth_user_id: "user-auth-1",
        role: "user",
        name: "User",
        active: true
      }),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn()
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      body: { authUserId: "target-auth-1", patch: { active: false } }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "admin_required" });
    expect(profileClient.updateAppUserProfile).not.toHaveBeenCalled();
  });

  it("treats a second active admin as an equivalent system manager", async () => {
    const secondAdminProfile = {
      ...adminProfile,
      id: "admin-2",
      auth_user_id: "admin-auth-2",
      name: "Second Admin",
      email: "second-admin@example.com"
    };
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "admin-auth-2", email: "second-admin@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue(secondAdminProfile),
      getAppUserProfileByAuthUserId: vi.fn().mockResolvedValue({ id: "target-2", auth_user_id: "target-auth-2", role: "user", active: true }),
      hasOtherActiveAdmin: vi.fn(),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn().mockResolvedValue({
        id: "target-2",
        auth_user_id: "target-auth-2",
        role: "user",
        active: true
      })
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer second-admin-token" },
      body: {
        authUserId: "target-auth-2",
        patch: { role: "user", active: true, departments: ["Ops"] }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("target-auth-2", {
      role: "user",
      active: true,
      departments: ["Ops"]
    });
  });

  it("returns 400 when authUserId is missing", async () => {
    const profileClient = {
      getAuthUser: vi.fn(),
      getAppUserProfile: vi.fn(),
      updateAuthEmail: vi.fn(),
      updateAppUserProfile: vi.fn()
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer admin-token" },
      body: { patch: { active: false } }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "auth_user_id_required" });
    expect(profileClient.getAuthUser).not.toHaveBeenCalled();
  });

  it("updates Supabase Auth when email is included in the patch", async () => {
    const profileClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "admin-auth-1", email: "owner@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue(adminProfile),
      updateAuthEmail: vi.fn().mockResolvedValue({ id: "target-auth-1", email: "target2@example.com" }),
      updateAppUserProfile: vi.fn().mockResolvedValue({
        id: "target-1",
        auth_user_id: "target-auth-1",
        email: "target2@example.com"
      })
    };
    const handler = createAdminProfileHandler({ profileClient });

    const res = await call(handler, {
      headers: { authorization: "Bearer admin-token" },
      body: {
        authUserId: "target-auth-1",
        patch: { email: "TARGET2@Example.COM" }
      }
    });

    expect(res.statusCode).toBe(200);
    expect(profileClient.updateAuthEmail).toHaveBeenCalledWith("target-auth-1", "target2@example.com");
    expect(profileClient.updateAppUserProfile).toHaveBeenCalledWith("target-auth-1", { email: "target2@example.com" });
  });
});
