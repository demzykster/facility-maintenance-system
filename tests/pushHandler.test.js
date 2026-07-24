import { describe, expect, it, vi } from "vitest";
import { createNormalizedPushSubscriptionStore, createPushHandler } from "../server/push/handler.js";

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
  await handler({ headers: {}, method: "GET", ...req }, res);
  return res;
}

const env = {
  CMMS_PUSH_VAPID_PUBLIC_KEY: "public-key",
  CMMS_PUSH_VAPID_PRIVATE_KEY: "private-key",
  CMMS_PUSH_CONTACT: "mailto:owner@example.com"
};

const activeSessionClient = {
  getAuthUser: vi.fn().mockResolvedValue({ id: "auth-user-1", email: "admin@example.com" }),
  getAppUserProfile: vi.fn().mockResolvedValue({
    id: "app-user-1",
    auth_user_id: "auth-user-1",
    role: "admin",
    name: "Owner",
    email: "admin@example.com",
    active: true,
    permissions: {},
    must_change_password: false
  })
};

const workerSessionClient = {
  getAuthUser: vi.fn().mockResolvedValue({ id: "auth-worker-1", email: "worker@example.com" }),
  getAppUserProfile: vi.fn().mockResolvedValue({
    id: "worker-1",
    auth_user_id: "auth-worker-1",
    role: "worker",
    name: "Worker",
    active: true,
    permissions: {},
    must_change_password: false
  })
};

const subscription = {
  endpoint: "https://push.example/device/1",
  keys: { p256dh: "p256", auth: "auth" }
};

describe("push API handler", () => {
  it("publishes whether web push is configured without exposing private keys", async () => {
    const handler = createPushHandler({ env, push: { setVapidDetails: vi.fn() } });

    const res = await call(handler, {});

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, enabled: true, publicKey: "public-key" });
  });

  it("stays disabled safely when VAPID env is missing", async () => {
    const handler = createPushHandler({ env: {}, push: { setVapidDetails: vi.fn() } });

    const config = await call(handler, {});
    const post = await call(handler, { method: "POST", headers: { authorization: "Bearer token" }, body: { action: "test" } });

    expect(config.json()).toEqual({ ok: true, enabled: false, publicKey: "" });
    expect(post.statusCode).toBe(503);
    expect(post.json()).toEqual({ error: "push_not_configured" });
  });

  it("stores a user subscription and sends a test notification", async () => {
    let stored = "";
    const driver = {
      get: vi.fn().mockImplementation(async () => stored),
      set: vi.fn().mockImplementation(async (_key, value) => { stored = value; })
    };
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({
      driver,
      push,
      env,
      sessionClient: activeSessionClient,
      configDriver: { get: vi.fn().mockResolvedValue({ config: { companyName: "Ogen | עוגן" } }) }
    });

    const subscribe = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "subscribe", subscription }
    });
    const test = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "test" }
    });

    expect(subscribe.statusCode).toBe(200);
    expect(subscribe.json()).toMatchObject({ ok: true, id: expect.any(String) });
    expect(test.json()).toEqual({ ok: true, sent: 1 });
    expect(push.setVapidDetails).toHaveBeenCalledWith("mailto:owner@example.com", "public-key", "private-key");
    expect(JSON.parse(push.sendNotification.mock.calls[0][1])).toMatchObject({
      title: "Ogen | עוגן",
      body: "התראות לטלפון הופעלו"
    });
  });

  it("can store subscriptions through the normalized subscription store", async () => {
    let list = [];
    const subscriptionStore = {
      list: vi.fn().mockImplementation(async () => list),
      upsert: vi.fn().mockImplementation(async (record) => {
        list = [record, ...list.filter((item) => item.id !== record.id)];
      }),
      deleteMany: vi.fn().mockImplementation(async (ids) => {
        const removeIds = new Set(ids);
        list = list.filter((item) => !removeIds.has(item.id));
      })
    };
    const handler = createPushHandler({
      subscriptionStore,
      push: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
      env,
      sessionClient: activeSessionClient
    });

    const subscribe = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "subscribe", subscription }
    });
    const unsubscribe = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "unsubscribe", subscription }
    });

    expect(subscribe.statusCode).toBe(200);
    expect(subscriptionStore.upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: "app-user-1",
      subscription
    }));
    expect(unsubscribe.statusCode).toBe(200);
    expect(subscriptionStore.deleteMany).toHaveBeenCalledWith([subscribe.json().id]);
  });

  it("can run normalized subscription storage without a KV mirror", async () => {
    let list = [];
    const driver = {
      list: vi.fn().mockImplementation(async () => list),
      upsert: vi.fn().mockImplementation(async (record) => {
        list = [record, ...list.filter((item) => item.id !== record.id)];
      }),
      delete: vi.fn().mockImplementation(async (id) => {
        list = list.filter((item) => item.id !== id);
      })
    };
    const mirrorDriver = {
      get: vi.fn(),
      set: vi.fn()
    };
    const store = createNormalizedPushSubscriptionStore({ driver, mirrorDriver: null });
    await store.upsert({ id: "push-1", userId: "user-1", subscription });
    await store.deleteMany(["push-1"]);

    expect(driver.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "push-1" }));
    expect(driver.delete).toHaveBeenCalledWith("push-1");
    expect(mirrorDriver.set).not.toHaveBeenCalled();
  });

  it("sends a business notification only to explicit subscribed targets", async () => {
    let stored = "";
    const driver = {
      get: vi.fn().mockImplementation(async () => stored),
      set: vi.fn().mockImplementation(async (_key, value) => { stored = value; })
    };
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({
      driver,
      push,
      env,
      sessionClient: activeSessionClient,
      configDriver: { get: vi.fn().mockResolvedValue({ config: { companyName: "Ogen | עוגן" } }) }
    });

    await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "subscribe", subscription }
    });
    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1"],
          title: "קריאה חדשה",
          body: "נפתחה קריאה חדשה",
          url: "/tickets",
          kind: "new",
          dedupeKey: "ticket-1"
        }
      }
    });

    expect(notify.statusCode).toBe(200);
    expect(notify.json()).toEqual({ ok: true, sent: 1, targets: 1 });
    expect(JSON.parse(push.sendNotification.mock.calls.at(-1)[1])).toMatchObject({
      title: "Ogen | עוגן",
      body: "נפתחה קריאה חדשה"
    });
  });

  it("blocks business notification sends from worker sessions", async () => {
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({
      subscriptionStore: {
        list: vi.fn().mockResolvedValue([{
          id: "push-1",
          userId: "app-user-1",
          userRole: "admin",
          subscription
        }])
      },
      push,
      env,
      sessionClient: workerSessionClient
    });

    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1"],
          title: "Fake urgent alert",
          body: "Fake alert",
          kind: "new"
        }
      }
    });

    expect(notify.statusCode).toBe(403);
    expect(notify.json()).toEqual({ error: "permission_required:push:notify" });
    expect(push.sendNotification).not.toHaveBeenCalled();
  });

  it("continues sending business notifications when one push target fails", async () => {
    const subscriptionTwo = {
      endpoint: "https://push.example/device/2",
      keys: { p256dh: "p256-2", auth: "auth-2" }
    };
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn()
        .mockRejectedValueOnce(new Error("push_failed"))
        .mockResolvedValueOnce(undefined)
    };
    const handler = createPushHandler({
      subscriptionStore: {
        list: vi.fn().mockResolvedValue([
          { id: "push-1", userId: "app-user-1", userRole: "admin", subscription },
          { id: "push-2", userId: "app-user-2", userRole: "admin", subscription: subscriptionTwo }
        ])
      },
      push,
      env,
      sessionClient: activeSessionClient
    });

    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1", "app-user-2"],
          title: "קריאה חדשה",
          body: "נפתחה קריאה חדשה",
          kind: "new"
        }
      }
    });

    expect(notify.statusCode).toBe(200);
    expect(notify.json()).toEqual({ ok: true, sent: 1, failed: 1, targets: 2 });
    expect(push.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does not send non-interrupting business events through server push", async () => {
    let stored = "";
    const driver = {
      get: vi.fn().mockImplementation(async () => stored),
      set: vi.fn().mockImplementation(async (_key, value) => { stored = value; })
    };
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({ driver, push, env, sessionClient: activeSessionClient });

    await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "subscribe", subscription }
    });
    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1"],
          title: "מסמך פג-תוקף",
          body: "30 ימים",
          kind: "doc",
          dedupeKey: "doc-194336"
        }
      }
    });

    expect(notify.statusCode).toBe(200);
    expect(notify.json()).toEqual({ ok: true, sent: 0, targets: 0, skipped: "non_interrupting" });
    expect(push.sendNotification).not.toHaveBeenCalled();
  });

  it("drops waiting return reminders from server push delivery", async () => {
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({
      subscriptionStore: {
        list: vi.fn().mockResolvedValue([{ id: "push-1", userId: "app-user-1", userRole: "admin", subscription }])
      },
      push,
      env,
      sessionClient: activeSessionClient
    });

    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1"],
          title: "חזרה לטיפול",
          body: "מועד ההמתנה הגיע",
          kind: "waiting",
          dedupeKey: "wait-return-ticket-1-1000"
        }
      }
    });

    expect(notify.statusCode).toBe(200);
    expect(notify.json()).toEqual({ ok: true, sent: 0, targets: 0, skipped: "non_interrupting" });
    expect(push.sendNotification).not.toHaveBeenCalled();
  });

  it("uses fresh user notification preferences before sending business push", async () => {
    let stored = "";
    const driver = {
      get: vi.fn().mockImplementation(async (key) => {
        if (key === "pushSubscriptions:v1") return stored;
        if (key === "user:app-user-1") return JSON.stringify({
          id: "app-user-1",
          role: "admin",
          notificationPrefs: { enabled: { new: false } }
        });
        return "";
      }),
      set: vi.fn().mockImplementation(async (_key, value) => { stored = value; })
    };
    const push = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createPushHandler({ driver, push, env, sessionClient: activeSessionClient });

    await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: { action: "subscribe", subscription }
    });
    const notify = await call(handler, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        action: "notify",
        event: {
          targetUserIds: ["app-user-1"],
          title: "קריאה חדשה",
          body: "נפתחה קריאה חדשה",
          kind: "new"
        }
      }
    });

    expect(notify.statusCode).toBe(200);
    expect(notify.json()).toEqual({ ok: true, sent: 0, targets: 0 });
    expect(push.sendNotification).not.toHaveBeenCalled();
  });
});
