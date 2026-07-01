import { describe, expect, it, vi } from "vitest";
import { createInitialPasswordHandler } from "../server/session/initialPasswordHandler.js";

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
  active: true,
  pin: "",
  password: "",
  dept: "נפחי"
};

const newManager = {
  id: "manager-1",
  name: "Manager One",
  role: "user",
  email: "manager@example.com",
  active: true,
  password: "",
  dept: "נפחי",
  depts: ["נפחי"]
};

describe("initial password handler", () => {
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
      user: { name: "Worker One", role: "worker", workerNo: "1042", email: "" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("completes first PIN setup without generating an activation link", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify(newWorker) }]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createInitialPasswordHandler({ driver, now: () => 123456 });

    const res = await call(handler, { body: { action: "complete", identifier: "1042", pin: "6789" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: { id: "worker-1", name: "Worker One", role: "worker", workerNo: "1042" },
      auth: null
    });
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
      auth: { access_token: "access" }
    });
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

  it("does not allow first setup when a secret already exists", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([{ key: "user:worker-1", value: JSON.stringify({ ...newWorker, pin: "1234" }) }]),
      set: vi.fn()
    };
    const handler = createInitialPasswordHandler({ driver });

    const res = await call(handler, { body: { action: "validate", identifier: "1042" } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "initial_secret_already_configured" });
    expect(driver.set).not.toHaveBeenCalled();
  });
});
