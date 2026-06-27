import { describe, expect, it, vi } from "vitest";
import { createKvApiHandler } from "../api/kv/handler.js";

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

describe("kv API handler", () => {
  it("does not expose storage without explicit auth configuration", async () => {
    const handler = createKvApiHandler({ env: {} });

    const res = await call(handler, { query: { key: "ticket:1" } });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "storage_auth_not_configured" });
  });

  it("does not claim storage works before a backend driver is configured", async () => {
    const handler = createKvApiHandler({ env: { CMMS_KV_BEARER_TOKEN: "secret" } });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      query: { key: "ticket:1" }
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "storage_backend_not_configured" });
  });

  it("serves get/set/delete/list through the configured backend driver", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("ticket-json"),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue(["ticket:1"])
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    expect((await call(handler, { query: { key: "ticket:1", shared: "1" } })).json()).toEqual({ value: "ticket-json" });
    expect((await call(handler, { method: "PUT", query: { key: "ticket:1" }, body: { value: "ticket-json", shared: true } })).json()).toEqual({ ok: true });
    expect((await call(handler, { method: "DELETE", query: { key: "ticket:1", shared: "1" } })).json()).toEqual({ ok: true });
    expect((await call(handler, { query: { prefix: "ticket:", shared: "1" } })).json()).toEqual({ keys: ["ticket:1"] });

    expect(driver.get).toHaveBeenCalledWith("ticket:1", true);
    expect(driver.set).toHaveBeenCalledWith("ticket:1", "ticket-json", true);
    expect(driver.delete).toHaveBeenCalledWith("ticket:1", true);
    expect(driver.list).toHaveBeenCalledWith("ticket:", true);
  });

  it("wires the upstash driver from server env after auth passes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify({ result: "ticket-json" });
      }
    });
    const handler = createKvApiHandler({
      env: {
        CMMS_KV_DRIVER: "upstash",
        CMMS_KV_BEARER_TOKEN: "secret",
        KV_REST_API_URL: "https://redis.example",
        KV_REST_API_TOKEN: "redis-secret"
      },
      fetchImpl
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: "ticket-json" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(["GET", "shared:ticket:1"]);
  });

  it("wires the supabase driver from server env after auth passes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      async text() {
        return JSON.stringify([{ value: "ticket-json" }]);
      }
    });
    const handler = createKvApiHandler({
      env: {
        CMMS_KV_DRIVER: "supabase",
        CMMS_KV_BEARER_TOKEN: "secret",
        SUPABASE_URL: "https://supabase.example",
        SUPABASE_SERVICE_ROLE_KEY: "service-key"
      },
      fetchImpl
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer secret" },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: "ticket-json" });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.ticket%3A1&select=value&limit=1");
  });

  it("can require a Supabase user bearer token before serving storage", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("ticket-json")
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        active: true,
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const missing = await call(handler, { query: { key: "ticket:1" } });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "supabase_access_token_required" });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: "ticket-json" });
    expect(sessionClient.getAuthUser).toHaveBeenCalledWith("user-token");
    expect(sessionClient.getAppUserProfile).toHaveBeenCalledWith("user-token", "auth-user-1");
  });

  it("blocks storage while a production password change is still required", async () => {
    const driver = { get: vi.fn() };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        active: true,
        must_change_password: true
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      headers: { authorization: "Bearer user-token" },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "password_change_required" });
    expect(driver.get).not.toHaveBeenCalled();
  });

  it("blocks sensitive Supabase-authenticated writes without the matching module permission", async () => {
    const driver = { set: vi.fn() };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Manager",
        active: true,
        permissions: { users: "view" },
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "user:worker-1", shared: "1" },
      body: { value: "{}" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:users:manage" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("allows sensitive Supabase-authenticated writes with the matching module permission", async () => {
    const driver = { set: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Manager",
        active: true,
        permissions: { users: "manage" },
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "user:worker-1", shared: "1" },
      body: { value: "{\"id\":\"worker-1\"}" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(driver.set).toHaveBeenCalledWith("user:worker-1", "{\"id\":\"worker-1\"}", true);
  });

  it("allows admins to write sensitive Supabase-authenticated records", async () => {
    const driver = { delete: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Owner",
        active: true,
        permissions: {},
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      method: "DELETE",
      headers: { authorization: "Bearer user-token" },
      query: { key: "config:v1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(driver.delete).toHaveBeenCalledWith("config:v1", true);
  });

  it("keeps ordinary workflow writes available to active Supabase-authenticated users", async () => {
    const driver = { set: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Reporter",
        active: true,
        permissions: {},
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const ticket = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "ticket:T-001", shared: "1" },
      body: { value: "{\"id\":\"T-001\"}" }
    });
    const ppeRequest = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "ppereq:req-1", shared: "1" },
      body: { value: "{\"id\":\"req-1\"}" }
    });

    expect(ticket.statusCode).toBe(200);
    expect(ppeRequest.statusCode).toBe(200);
    expect(driver.set).toHaveBeenCalledWith("ticket:T-001", "{\"id\":\"T-001\"}", true);
    expect(driver.set).toHaveBeenCalledWith("ppereq:req-1", "{\"id\":\"req-1\"}", true);
  });
});
