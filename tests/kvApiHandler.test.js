import { describe, expect, it, vi } from "vitest";
import { createKvApiHandler } from "../server/kv/handler.js";
import { signCmmsSessionToken } from "../server/session/cmmsSessionToken.js";

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

  it("saves multiple records through the configured backend driver", async () => {
    const driver = {
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        records: [
          { key: "fleet:1", value: "{\"id\":\"fleet-1\"}" },
          { key: "fleet:2", value: "{\"id\":\"fleet-2\"}" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 2 });
    expect(driver.set).toHaveBeenCalledWith("fleet:1", "{\"id\":\"fleet-1\"}", true);
    expect(driver.set).toHaveBeenCalledWith("fleet:2", "{\"id\":\"fleet-2\"}", true);
  });

  it("rejects malformed or unknown KV keys before touching the backend", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("value"),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const badChars = await call(handler, { query: { key: "ticket:1?debug=true" } });
    const badPrefix = await call(handler, { method: "PUT", query: { key: "unknown:1" }, body: { value: "x" } });

    expect(badChars.statusCode).toBe(400);
    expect(badChars.json()).toEqual({ error: "key_invalid" });
    expect(badPrefix.statusCode).toBe(400);
    expect(badPrefix.json()).toEqual({ error: "key_prefix_not_allowed" });
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("rejects malformed or unknown KV batch keys before touching the backend", async () => {
    const driver = {
      set: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        records: [{ key: "unplanned:1", value: "{}" }]
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "record_key_invalid", reason: "key_prefix_not_allowed" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests from the same unauthenticated client", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("value")
    };
    const handler = createKvApiHandler({
      driver,
      env: {
        CMMS_KV_ALLOW_UNAUTHENTICATED: "true",
        CMMS_KV_RATE_LIMIT_MAX: "1",
        CMMS_KV_RATE_LIMIT_WINDOW_MS: "60000"
      }
    });

    const first = await call(handler, { headers: { "x-forwarded-for": "198.51.100.10" }, query: { key: "ticket:1" } });
    const second = await call(handler, { headers: { "x-forwarded-for": "198.51.100.10" }, query: { key: "ticket:1" } });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBe("60");
    expect(second.json()).toEqual({ error: "rate_limit_exceeded" });
  });

  it("uses bulk KV and audit drivers for atomic batches when available", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      getMany: vi.fn().mockResolvedValue([]),
      set: vi.fn(),
      setMany: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn()
    };
    const auditDriver = {
      write: vi.fn(),
      writeMany: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, auditDriver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        atomic: true,
        records: [
          { key: "fleet:1", value: "{\"id\":\"fleet-1\"}" },
          { key: "fleet:2", value: "{\"id\":\"fleet-2\"}" }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 2, atomic: true });
    expect(driver.getMany).not.toHaveBeenCalled();
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.setMany).toHaveBeenCalledWith([
      { key: "fleet:1", value: "{\"id\":\"fleet-1\"}" },
      { key: "fleet:2", value: "{\"id\":\"fleet-2\"}" }
    ], true);
    expect(driver.set).not.toHaveBeenCalled();
    expect(auditDriver.writeMany).toHaveBeenCalledWith([
      expect.objectContaining({ entityId: "fleet:1" }),
      expect.objectContaining({ entityId: "fleet:2" })
    ]);
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("does not prefetch a large fleet import batch before one bulk write", async () => {
    const fleetRecords = Array.from({ length: 126 }, (_, index) => ({
      key: `fleet:${index + 1}`,
      value: JSON.stringify({ id: `fleet-${index + 1}` })
    }));
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      getMany: vi.fn().mockResolvedValue([]),
      setMany: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn()
    };
    const auditDriver = {
      write: vi.fn(),
      writeMany: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, auditDriver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        atomic: true,
        records: fleetRecords
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, count: 126, atomic: true });
    expect(driver.getMany).not.toHaveBeenCalled();
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.setMany).toHaveBeenCalledTimes(1);
    expect(auditDriver.writeMany).toHaveBeenCalledTimes(1);
  });

  it("still prefetches ticket records before atomic bulk status audit", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(null),
      getMany: vi.fn().mockResolvedValue([
        { key: "ticket:T-1", value: JSON.stringify({ id: "T-1", status: "open" }) }
      ]),
      setMany: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn()
    };
    const auditDriver = {
      write: vi.fn(),
      writeMany: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, auditDriver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        atomic: true,
        records: [
          { key: "ticket:T-1", value: JSON.stringify({ id: "T-1", status: "closed" }) }
        ]
      }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.getMany).toHaveBeenCalledWith(["ticket:T-1"], true);
    expect(driver.setMany).toHaveBeenCalledTimes(1);
    expect(auditDriver.writeMany).toHaveBeenCalledWith([
      expect.objectContaining({ entityId: "T-1" })
    ]);
  });

  it("rolls back an atomic batch when a later write fails", async () => {
    const driver = {
      get: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("{\"id\":\"old\"}"),
      set: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("write_failed"))
        .mockResolvedValueOnce(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      method: "POST",
      body: {
        shared: true,
        atomic: true,
        records: [
          { key: "fleet:1", value: "{\"id\":\"fleet-1\"}" },
          { key: "fleet:2", value: "{\"id\":\"fleet-2\"}" }
        ]
      }
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "atomic_batch_failed", rolledBack: 1 });
    expect(driver.get).toHaveBeenCalledWith("fleet:1", true);
    expect(driver.get).toHaveBeenCalledWith("fleet:2", true);
    expect(driver.delete).toHaveBeenCalledWith("fleet:1", true);
    expect(driver.set).not.toHaveBeenCalledWith("fleet:2", "{\"id\":\"old\"}", true);
  });

  it("can return matching key values in one collection response", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "ticket:1", value: "{\"id\":\"ticket-1\"}" },
        { key: "ticket:2", value: "{\"id\":\"ticket-2\"}" }
      ])
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      query: { prefix: "ticket:", shared: "1", includeValues: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      records: [
        { key: "ticket:1", value: "{\"id\":\"ticket-1\"}" },
        { key: "ticket:2", value: "{\"id\":\"ticket-2\"}" }
      ]
    });
    expect(driver.listValues).toHaveBeenCalledWith("ticket:", true);
  });

  it("can return multiple collection value groups in one response", async () => {
    const driver = {
      listValuesMany: vi.fn().mockResolvedValue({
        "ticket:": [{ key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }],
        "fleet:": [{ key: "fleet:1", value: "{\"id\":\"fleet-1\"}" }]
      })
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    const res = await call(handler, {
      query: { prefixes: "ticket:,fleet:", shared: "1", includeValues: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      collections: {
        "ticket:": [{ key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }],
        "fleet:": [{ key: "fleet:1", value: "{\"id\":\"fleet-1\"}" }]
      }
    });
    expect(driver.listValuesMany).toHaveBeenCalledWith(["ticket:", "fleet:"], true);
  });

  it("redacts sensitive user records in collection value responses", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        {
          key: "user:worker-1",
          value: JSON.stringify({
            id: "worker-1",
            name: "Worker",
            pin: "1234",
            password: "secret",
            activationToken: "token",
            activationStatus: "pending"
          })
        }
      ])
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Viewer",
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
      headers: { authorization: "Bearer user-token" },
      query: { prefix: "user:", shared: "1", includeValues: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.json().records[0].value)).toEqual({
      id: "worker-1",
      name: "Worker",
      activationStatus: "pending"
    });
  });

  it("filters user collection reads to the current worker when the session cannot view users", async () => {
    const driver = {
      listValues: vi.fn().mockResolvedValue([
        { key: "user:worker-1", value: JSON.stringify({ id: "worker-1", name: "Worker One", pin: "1234" }) },
        { key: "user:worker-2", value: JSON.stringify({ id: "worker-2", name: "Worker Two", pin: "5678" }) }
      ])
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-worker-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "worker-1",
        auth_user_id: "auth-worker-1",
        role: "worker",
        name: "Worker One",
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
      headers: { authorization: "Bearer worker-token" },
      query: { prefix: "user:", shared: "1", includeValues: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().records).toHaveLength(1);
    expect(JSON.parse(res.json().records[0].value)).toEqual({ id: "worker-1", name: "Worker One" });
  });

  it("blocks direct user record reads outside the current user or users permission", async () => {
    const driver = { get: vi.fn() };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-worker-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "worker-1",
        auth_user_id: "auth-worker-1",
        role: "worker",
        name: "Worker One",
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
      headers: { authorization: "Bearer worker-token" },
      query: { key: "user:worker-2", shared: "1" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:users:view" });
    expect(driver.get).not.toHaveBeenCalled();
  });

  it("filters sensitive key-only lists for sessions without read permission", async () => {
    const driver = {
      list: vi.fn().mockResolvedValue(["user:worker-1", "user:worker-2", "appIssue:issue-1"])
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-worker-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "worker-1",
        auth_user_id: "auth-worker-1",
        role: "worker",
        name: "Worker One",
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
      headers: { authorization: "Bearer worker-token" },
      query: { prefix: "user:", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ keys: ["user:worker-1"] });
  });

  it("hides app issue collections from ordinary workers", async () => {
    const driver = {
      listValuesMany: vi.fn().mockResolvedValue({
        "appIssue:": [{ key: "appIssue:issue-1", value: "{\"id\":\"issue-1\"}" }],
        "ticket:": [{ key: "ticket:T-1", value: "{\"id\":\"T-1\"}" }]
      })
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-worker-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "worker-1",
        auth_user_id: "auth-worker-1",
        role: "worker",
        name: "Worker One",
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
      headers: { authorization: "Bearer worker-token" },
      query: { prefixes: "appIssue:,ticket:", shared: "1", includeValues: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      collections: {
        "appIssue:": [],
        "ticket:": [{ key: "ticket:T-1", value: "{\"id\":\"T-1\"}" }]
      }
    });
  });

  it("hides unexpected backend failures behind a request id", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const driver = {
      get: vi.fn().mockRejectedValue(new Error("internal-driver-secret"))
    };
    const handler = createKvApiHandler({ driver, env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" } });

    try {
      const res = await call(handler, {
        headers: { "x-request-id": "kv-req-1" },
        query: { key: "ticket:1" }
      });

      expect(res.statusCode).toBe(500);
      expect(res.headers["x-cmms-request-id"]).toBe("kv-req-1");
      expect(res.json()).toEqual({ error: "storage_api_error", requestId: "kv-req-1" });
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(JSON.parse(consoleError.mock.calls[0][0])).toMatchObject({
        requestId: "kv-req-1",
        route: "/api/kv",
        code: "storage_api_error",
        message: "internal-driver-secret"
      });
    } finally {
      consoleError.mockRestore();
    }
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

  it("accepts a CMMS PIN token before serving storage in Supabase auth mode", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("ticket-json")
    };
    const sessionClient = {
      getAuthUser: vi.fn(),
      getAppUserProfile: vi.fn()
    };
    const token = signCmmsSessionToken("worker-1", "worker", "1042", "session-secret", Date.now()).token;
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase", CMMS_SESSION_SECRET: "session-secret" }
    });

    const res = await call(handler, {
      headers: { authorization: `Bearer ${token}` },
      query: { key: "ticket:1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: "ticket-json" });
    expect(driver.get).toHaveBeenCalledWith("ticket:1", true);
    expect(sessionClient.getAuthUser).not.toHaveBeenCalled();
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

  it("blocks sensitive Supabase-authenticated batch writes without the matching module permission", async () => {
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
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        shared: true,
        records: [{ key: "user:worker-1", value: "{}" }]
      }
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

  it("redacts user login secrets from Supabase-authenticated reads without user management permission", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        id: "worker-1",
        name: "Worker",
        workerNo: "1042",
        pin: "1234",
        password: "secret",
        activationToken: "token",
        activationStatus: "pending"
      }))
    };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Viewer",
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
      headers: { authorization: "Bearer user-token" },
      query: { key: "user:worker-1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.json().value)).toEqual({
      id: "worker-1",
      name: "Worker",
      workerNo: "1042",
      activationStatus: "pending"
    });
  });

  it("keeps full user records readable for admins", async () => {
    const rawUser = JSON.stringify({
      id: "worker-1",
      name: "Worker",
      pin: "1234",
      activationToken: "token"
    });
    const driver = { get: vi.fn().mockResolvedValue(rawUser) };
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
      headers: { authorization: "Bearer user-token" },
      query: { key: "user:worker-1", shared: "1" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ value: rawUser });
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

  it("no-ops retired production API KV mirror writes without touching storage", async () => {
    const driver = { set: vi.fn(), setMany: vi.fn() };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "user-1",
        auth_user_id: "auth-user-1",
        role: "admin",
        name: "Admin",
        active: true,
        permissions: {},
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      sessionClient,
      env: {
        CMMS_KV_AUTH: "supabase",
        VITE_CMMS_APP_MODE: "production",
        VITE_CMMS_STORAGE_PROVIDER: "api"
      }
    });

    const putRes = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "presence:user-1", shared: "1" },
      body: { value: "{\"id\":\"user-1\"}", shared: true }
    });
    const pushPutRes = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "pushSubscriptions:v1", shared: "1" },
      body: { value: "[]", shared: true }
    });
    const postRes = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        shared: true,
        records: [
          { key: "presence:user-1", value: "{\"id\":\"user-1\"}" },
          { key: "pushSubscriptions:v1", value: "[]" }
        ]
      }
    });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.json()).toEqual({ ok: true, retired: true, retiredPrefix: "presence:" });
    expect(pushPutRes.statusCode).toBe(200);
    expect(pushPutRes.json()).toEqual({ ok: true, retired: true, retiredPrefix: "pushSubscriptions:v1" });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json()).toEqual({ ok: true, count: 0, retired: 2 });
    expect(driver.set).not.toHaveBeenCalled();
    expect(driver.setMany).not.toHaveBeenCalled();
  });

  it("writes audit events for successful sensitive Supabase-authenticated writes when an audit sink is configured", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("{\"before\":true}"),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
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
      auditDriver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "config:v1", shared: "1" },
      body: { value: "{\"after\":true}" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.get).toHaveBeenCalledWith("config:v1", true);
    expect(driver.set).toHaveBeenCalledWith("config:v1", "{\"after\":true}", true);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      actorName: "Owner",
      entityType: "settings",
      entityId: "config:v1",
      action: "update",
      before: { value: "{\"before\":true}" },
      after: { value: "{\"after\":true}" }
    }));
  });

  it("can wire the Supabase audit sink from server env", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return JSON.stringify([{ value: "{\"before\":true}" }]);
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return "";
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        async text() {
          return "";
        }
      });
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
      fetchImpl,
      sessionClient,
      env: {
        CMMS_KV_AUTH: "supabase",
        CMMS_KV_DRIVER: "supabase",
        CMMS_AUDIT_DRIVER: "supabase",
        SUPABASE_URL: "https://supabase.example",
        SUPABASE_SERVICE_ROLE_KEY: "service-key"
      }
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "config:v1", shared: "1" },
      body: { value: "{\"after\":true}" }
    });

    expect(res.statusCode).toBe(200);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://supabase.example/rest/v1/cmms_kv_records?scope=eq.shared&record_key=eq.config%3Av1&select=value&limit=1",
      "https://supabase.example/rest/v1/cmms_kv_records?on_conflict=scope,record_key",
      "https://supabase.example/rest/v1/audit_events"
    ]);
  });

  it("does not audit ordinary workflow writes through the KV bridge", async () => {
    const driver = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn() };
    const handler = createKvApiHandler({
      driver,
      auditDriver,
      env: { CMMS_KV_ALLOW_UNAUTHENTICATED: "true" }
    });

    const res = await call(handler, {
      method: "PUT",
      query: { key: "ppereq:req-1", shared: "1" },
      body: { value: "{\"id\":\"req-1\"}" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.get).not.toHaveBeenCalled();
    expect(auditDriver.write).not.toHaveBeenCalled();
  });

  it("writes ticket status audit events only when the stored ticket status changes", async () => {
    const driver = {
      get: vi.fn().mockResolvedValue("{\"id\":\"T-001\",\"status\":\"new\",\"track\":\"שינוע\",\"num\":1}"),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const auditDriver = { write: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "user",
        name: "Manager",
        active: true,
        permissions: {},
        must_change_password: false
      })
    };
    const handler = createKvApiHandler({
      driver,
      auditDriver,
      sessionClient,
      env: { CMMS_KV_AUTH: "supabase" }
    });

    const res = await call(handler, {
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "ticket:T-001", shared: "1" },
      body: { value: "{\"id\":\"T-001\",\"status\":\"done\",\"track\":\"שינוע\",\"num\":1}" }
    });

    expect(res.statusCode).toBe(200);
    expect(driver.get).toHaveBeenCalledWith("ticket:T-001", true);
    expect(auditDriver.write).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "app-user-1",
      entityType: "ticket",
      entityId: "T-001",
      action: "status_change",
      before: { status: "new" },
      after: { status: "done" },
      metadata: { track: "שינוע", num: 1 }
    }));
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
        permissions: { ppe: "request" },
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

  it("blocks workflow writes outside the expected role or module permission", async () => {
    const driver = { set: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "tech",
        name: "Technician",
        active: true,
        permissions: { ppe: "view" },
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
      query: { key: "ppereq:req-1", shared: "1" },
      body: { value: "{\"id\":\"req-1\"}" }
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "permission_required:ppe:request" });
    expect(driver.set).not.toHaveBeenCalled();
  });

  it("blocks unknown shared KV prefixes for ordinary production users", async () => {
    const driver = { set: vi.fn().mockResolvedValue(undefined) };
    const sessionClient = {
      getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1" }),
      getAppUserProfile: vi.fn().mockResolvedValue({
        id: "app-user-1",
        auth_user_id: "auth-user-1",
        role: "worker",
        name: "Worker",
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
      method: "PUT",
      headers: { authorization: "Bearer user-token" },
      query: { key: "experimental:record-1", shared: "1" },
      body: { value: "{\"id\":\"record-1\"}" }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "key_prefix_not_allowed" });
    expect(driver.set).not.toHaveBeenCalled();
  });
});
