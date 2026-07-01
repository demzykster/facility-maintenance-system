import { describe, expect, it, vi } from "vitest";
import { createWorkerActivationHandler } from "../server/session/workerActivationHandler.js";

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

const pendingWorker = {
  id: "worker-1",
  name: "Worker One",
  role: "worker",
  workerNo: "1042",
  active: true,
  pin: "",
  activationToken: "activation-token-123",
  activationStatus: "pending",
  dept: "נפחי",
  perms: { ppe: "request" }
};

const pendingManager = {
  id: "manager-1",
  name: "Manager One",
  role: "user",
  email: "manager@example.com",
  active: true,
  password: "",
  activationToken: "activation-token-manager",
  activationStatus: "pending",
  dept: "נפחי",
  depts: ["נפחי"],
  perms: { fleet: "manage" }
};

describe("worker activation handler", () => {
  it("validates a pending worker activation token without exposing secrets", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify(pendingWorker) }
      ]),
      set: vi.fn()
    };
    const handler = createWorkerActivationHandler({ driver });

    const res = await call(handler, { body: { action: "validate", token: "activation-token-123" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      user: { name: "Worker One", role: "worker", workerNo: "1042", email: "" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("activates exactly the matching pending worker and clears the token", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:other", value: JSON.stringify({ ...pendingWorker, id: "other", activationToken: "other-token" }) },
        { key: "user:worker-1", value: JSON.stringify(pendingWorker) }
      ]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createWorkerActivationHandler({ driver, now: () => 123456 });

    const res = await call(handler, { body: { action: "activate", token: "activation-token-123", pin: "6789" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        id: "worker-1",
        name: "Worker One",
        role: "worker",
        workerNo: "1042",
        dept: "נפחי",
        perms: { ppe: "request" }
      }
    });
    expect(res.json().user).not.toHaveProperty("activationToken");
    expect(res.json().user).not.toHaveProperty("pin");
    expect(driver.set).toHaveBeenCalledWith("user:worker-1", JSON.stringify({
      ...pendingWorker,
      pin: "6789",
      password: "",
      authUserId: "",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: 123456
    }), true);
  });

  it("rejects already used or unknown activation tokens", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify({ ...pendingWorker, activationStatus: "activated" }) }
      ]),
      set: vi.fn()
    };
    const handler = createWorkerActivationHandler({ driver });

    const res = await call(handler, { body: { action: "activate", token: "activation-token-123", pin: "6789" } });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "activation_link_invalid" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("requires a 4 character code before changing the worker", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify(pendingWorker) }
      ]),
      set: vi.fn()
    };
    const handler = createWorkerActivationHandler({ driver });

    const res = await call(handler, { body: { action: "activate", token: "activation-token-123", pin: "123" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "pin_too_short" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("validates a pending manager activation token without exposing secrets", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:manager-1", value: JSON.stringify(pendingManager) }
      ]),
      set: vi.fn()
    };
    const handler = createWorkerActivationHandler({ driver });

    const res = await call(handler, { body: { action: "validate", token: "activation-token-manager" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      user: { name: "Manager One", role: "user", email: "manager@example.com", workerNo: "" }
    });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("activates password roles through Supabase Auth and clears the token", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:manager-1", value: JSON.stringify(pendingManager) }
      ]),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const passwordActivationClient = {
      activatePasswordUser: vi.fn().mockResolvedValue({
        auth: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600
        },
        user: {
          authUserId: "auth-user-1",
          mustChangePassword: false
        }
      })
    };
    const handler = createWorkerActivationHandler({ driver, passwordActivationClient, now: () => 123456 });

    const res = await call(handler, { body: { action: "activate", token: "activation-token-manager", password: "123456" } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      user: {
        id: "manager-1",
        name: "Manager One",
        role: "user",
        email: "manager@example.com",
        authUserId: "auth-user-1",
        mustChangePassword: false
      },
      auth: {
        access_token: "access-token",
        refresh_token: "refresh-token"
      }
    });
    expect(passwordActivationClient.activatePasswordUser).toHaveBeenCalledWith(pendingManager, "123456");
    expect(driver.set).toHaveBeenCalledWith("user:manager-1", JSON.stringify({
      ...pendingManager,
      pin: "",
      password: "",
      authUserId: "auth-user-1",
      activationToken: "",
      activationStatus: "activated",
      activatedAt: 123456
    }), true);
  });

  it("requires a 6 character password before changing password-role users", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:manager-1", value: JSON.stringify(pendingManager) }
      ]),
      set: vi.fn()
    };
    const passwordActivationClient = { activatePasswordUser: vi.fn() };
    const handler = createWorkerActivationHandler({ driver, passwordActivationClient });

    const res = await call(handler, { body: { action: "activate", token: "activation-token-manager", password: "12345" } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "password_too_short" });
    expect(passwordActivationClient.activatePasswordUser).not.toHaveBeenCalled();
    expect(driver.set).not.toHaveBeenCalled();
  });
});
