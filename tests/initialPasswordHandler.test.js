import { describe, expect, it, vi } from "vitest";
import { createInitialPasswordHandler, createSupabaseInitialPasswordClient } from "../server/session/initialPasswordHandler.js";

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
  await handler({ headers: {}, method: "POST", ...req }, res);
  return res;
}

const newWorker = {
  id: "worker-1",
  name: "Worker One",
  role: "worker",
  workerNo: "1042",
  phone: "050-111-2222",
  active: true,
  pin: "",
  password: "",
  dept: "נפחי"
};

const newTech = {
  id: "tech-1",
  name: "Tech One",
  role: "tech",
  phone: "050-333-4444",
  active: true,
  pin: "",
  password: "",
  techScope: "transport"
};

const newManager = {
  id: "manager-1",
  name: "Manager One",
  role: "user",
  email: "manager@example.com",
  phone: "050-555-6666",
  active: true,
  password: "",
  dept: "נפחי",
  depts: ["נפחי"]
};

describe("initial password handler", () => {
  it("validates an app_users worker that still needs first PIN setup without KV", async () => {
    const passwordClient = {
      findInitialUser: vi.fn().mockResolvedValue({
        id: "app-worker-1",
        name: "App Worker",
        role: "worker",
        workerNo: "2042",
        phone: "050-777-8888",
        active: true,
        loginState: "pending_setup",
        pinHash: ""
      })
    };
    const handler = createInitialPasswordHandler({ passwordClient });

    const res = await call(handler, { body: { action: "validate", identifier: "2042" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      needsSetup: true,
      auth: "pin",
      identifierType: "workerNo",
      user: { name: "App Worker", role: "worker", workerNo: "2042", email: "", phone: "050-777-8888" }
    });
  });

  it("completes app_users first PIN setup with a hash instead of a stored PIN", async () => {
    const appWorker = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "App Worker",
      role: "worker",
      workerNo: "2042",
      active: true,
      loginState: "pending_setup",
      pinHash: ""
    };
    const passwordClient = {
      findInitialUser: vi.fn().mockResolvedValue(appWorker),
      setPinHash: vi.fn().mockImplementation(async (_id, pinHash) => ({
        ...appWorker,
        pinHash,
        loginState: "active"
      }))
    };
    const pinHasher = vi.fn().mockResolvedValue("scrypt$hash");
    const handler = createInitialPasswordHandler({
      passwordClient,
      pinHasher,
      env: { CMMS_SESSION_SECRET: "session-secret" },
      now: () => 123456
    });

    const res = await call(handler, { body: { action: "complete", identifier: "2042", pin: "6789" } });

    expect(res.statusCode).toBe(200);
    expect(pinHasher).toHaveBeenCalledWith("6789");
    expect(passwordClient.setPinHash).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", "scrypt$hash", "1970-01-01T00:02:03.456Z");
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "App Worker",
        role: "worker",
        workerNo: "2042"
      }
    });
  });

  it("logs in an app_users worker by verifying the stored PIN hash", async () => {
    const passwordClient = {
      findInitialUser: vi.fn().mockResolvedValue({
        id: "app-worker-1",
        name: "App Worker",
        role: "worker",
        workerNo: "2042",
        active: true,
        loginState: "active",
        pinHash: "scrypt$hash"
      })
    };
    const pinVerifier = vi.fn().mockResolvedValue(true);
    const handler = createInitialPasswordHandler({
      passwordClient,
      pinVerifier,
      env: { CMMS_SESSION_SECRET: "session-secret" },
      now: () => 123456
    });

    const res = await call(handler, { body: { action: "login", identifier: "2042", pin: "6789" } });

    expect(res.statusCode).toBe(200);
    expect(pinVerifier).toHaveBeenCalledWith("6789", "scrypt$hash");
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "app-worker-1", name: "App Worker", role: "worker", workerNo: "2042" }
    });
  });

  it("rejects an app_users worker when PIN hash verification fails", async () => {
    const passwordClient = {
      findInitialUser: vi.fn().mockResolvedValue({
        id: "app-worker-1",
        name: "App Worker",
        role: "worker",
        workerNo: "2042",
        active: true,
        loginState: "active",
        pinHash: "scrypt$hash"
      })
    };
    const pinVerifier = vi.fn().mockResolvedValue(false);
    const handler = createInitialPasswordHandler({ passwordClient, pinVerifier });

    const res = await call(handler, { body: { action: "login", identifier: "2042", pin: "9999" } });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "pin_login_failed" });
  });

  it("validates a worker number that still needs first PIN setup", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify(newWorker) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver });

    const res = await call(handler, { body: { action: "validate", identifier: "1042" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      needsSetup: true,
      auth: "pin",
      identifierType: "workerNo",
      user: { name: "Worker One", role: "worker", workerNo: "1042", email: "", phone: "050-111-2222" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("validates a phone number as a first PIN setup identifier for a technician", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:tech-1", value: JSON.stringify(newTech) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver });

    const res = await call(handler, { body: { action: "validate", identifier: "0503334444" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      needsSetup: true,
      auth: "pin",
      identifierType: "phone",
      user: { name: "Tech One", role: "tech", workerNo: "", email: "", phone: "050-333-4444" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("completes technician first PIN setup by phone", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:tech-1", value: JSON.stringify(newTech) }]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createInitialPasswordHandler({ driver, env: { CMMS_SESSION_SECRET: "session-secret" }, now: () => 123456 });

    const res = await call(handler, { body: { action: "complete", identifier: "0503334444", pin: "2468" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "tech-1", name: "Tech One", role: "tech", phone: "050-333-4444" },
      auth: { accessToken: "", cookieSession: true, expiresAt: 86523000 },
      pinSessionExpiresAt: 86523000
    });
    expect(driver.set).toHaveBeenCalledWith("user:tech-1", JSON.stringify({
      ...newTech,
      pin: "2468",
      authUserId: "",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: 123456
    }), true);
  });

  it("validates a phone number as a first password setup identifier for a manager", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:manager-1", value: JSON.stringify(newManager) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver });

    const res = await call(handler, { body: { action: "validate", identifier: "0505556666" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      needsSetup: true,
      auth: "password",
      identifierType: "phone",
      user: { name: "Manager One", role: "user", email: "manager@example.com", phone: "050-555-6666" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("completes first PIN setup without generating an activation link", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify(newWorker) }]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createInitialPasswordHandler({ driver, env: { CMMS_SESSION_SECRET: "session-secret" }, now: () => 123456 });

    const res = await call(handler, { body: { action: "complete", identifier: "1042", pin: "6789" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "worker-1", name: "Worker One", role: "worker", workerNo: "1042" },
      auth: { accessToken: "", cookieSession: true, expiresAt: 86523000 },
      pinSessionExpiresAt: 86523000
    });
    expect(res.json().pinSessionToken).toEqual(expect.stringContaining("."));
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_access_token=");
    expect(driver.set).toHaveBeenCalledWith("user:worker-1", JSON.stringify({
      ...newWorker,
      pin: "6789",
      authUserId: "",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: 123456
    }), true);
  });

  it("completes first password setup through the Supabase password client", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:manager-1", value: JSON.stringify(newManager) }]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const passwordClient = {
      completePasswordUser: vi.fn().mockResolvedValue({
        auth: { access_token: "access", refresh_token: "refresh", expires_in: 3600 },
        user: { authUserId: "auth-1", appUserId: "app-1", mustChangePassword: false }
      })
    };
    const handler = createInitialPasswordHandler({ driver, passwordClient, now: () => 123456 });

    const res = await call(handler, { body: { action: "complete", identifier: "manager@example.com", password: "secret1" } });

    expect(res.statusCode).toBe(200);
    expect(passwordClient.completePasswordUser).toHaveBeenCalledWith(newManager, "secret1");
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "app-1", authUserId: "auth-1", email: "manager@example.com", role: "user" },
      auth: { accessToken: "", cookieSession: true }
    });
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_access_token=access");
    expect(driver.set).toHaveBeenCalledWith("user:manager-1", JSON.stringify({
      ...newManager,
      password: "",
      pin: "",
      authUserId: "auth-1",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: 123456
    }), true);
  });

  it("completes first password setup by updating an existing app_users row without creating a duplicate", async () => {
    const appUserId = "550e8400-e29b-41d4-a716-446655440001";
    const authUserId = "660e8400-e29b-41d4-a716-446655440002";
    const calls = [];
    const fetchImpl = vi.fn(async (url, options = {}) => {
      calls.push({ url, options });
      if (String(url).includes("/auth/v1/admin/users")) {
        return { ok: true, text: async () => JSON.stringify({ id: authUserId }) };
      }
      if (String(url).includes(`/rest/v1/app_users?id=eq.${encodeURIComponent(appUserId)}`)) {
        expect(options.method).toBe("PATCH");
        const body = JSON.parse(options.body);
        expect(body.auth_user_id).toBe(authUserId);
        expect(body.login_metadata).toMatchObject({ source: "initial-password", cmms_user_id: appUserId });
        return { ok: true, text: async () => JSON.stringify([{ id: appUserId, ...body, must_change_password: false }]) };
      }
      if (String(url).includes("/auth/v1/token?grant_type=password")) {
        return { ok: true, text: async () => JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }) };
      }
      throw new Error(`unexpected_fetch:${url}`);
    });
    const client = createSupabaseInitialPasswordClient({
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      SUPABASE_ANON_KEY: "anon"
    }, fetchImpl);

    const result = await client.completePasswordUser({
      id: appUserId,
      name: "Manager One",
      role: "user",
      email: "manager@example.com",
      dept: "נפחי",
      depts: ["נפחי"],
      permissions: { tickets: "manage" },
      active: true,
      loginState: "pending_setup"
    }, "secret1");

    expect(result).toMatchObject({
      auth: { access_token: "access" },
      user: {
        id: appUserId,
        authUserId,
        appUserId,
        name: "Manager One",
        role: "user",
        email: "manager@example.com",
        dept: "נפחי",
        depts: ["נפחי"],
        permissions: { tickets: "manage" },
        mustChangePassword: false
      }
    });
    expect(calls.some((call) => String(call.url).includes("/rest/v1/app_users?on_conflict=auth_user_id"))).toBe(false);
  });

  it("rejects first password setup when the stored email is not valid for Supabase Auth", async () => {
    const invalidEmailManager = { ...newManager, email: "123@123" };
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:manager-1", value: JSON.stringify(invalidEmailManager) }]),
      set: vi.fn()
    };
    const passwordClient = {
      completePasswordUser: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver, passwordClient });

    const res = await call(handler, { body: { action: "complete", identifier: "123@123", password: "secret1" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "valid_email_required" });
    expect(passwordClient.completePasswordUser).not.toHaveBeenCalled();
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("does not allow first setup when a secret already exists", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify({ ...newWorker, pin: "1234" }) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver, env: { CMMS_SESSION_SECRET: "session-secret" }, now: () => 123456 });

    const res = await call(handler, { body: { action: "validate", identifier: "1042" } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: "initial_secret_already_configured",
      auth: "pin",
      user: { name: "Worker One", role: "worker", workerNo: "1042" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("logs in an existing worker with a configured PIN", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify({ ...newWorker, pin: "1234" }) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver, env: { CMMS_SESSION_SECRET: "session-secret" }, now: () => 123456 });

    const res = await call(handler, { body: { action: "login", identifier: "1042", pin: "1234" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      auth: { accessToken: "", cookieSession: true, expiresAt: 86523000 },
      pinSessionExpiresAt: 86523000,
      user: { id: "worker-1", name: "Worker One", role: "worker", workerNo: "1042" }
    });
    expect(res.json().pinSessionToken).toEqual(expect.stringContaining("."));
    expect(res.headers["set-cookie"].join("\n")).toContain("cmms_access_token=");
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("rejects an existing worker login with the wrong PIN", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify({ ...newWorker, pin: "1234" }) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver });

    const res = await call(handler, { body: { action: "login", identifier: "1042", pin: "9999" } });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "pin_login_failed" });
    expect(driver.set).not.toHaveBeenCalled();
  });
});
