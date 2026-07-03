import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SHARED_STORAGE_TIMEOUT_MS, createAppStore, shouldClearExpiredNonRefreshAuth } from "../src/storageAdapter.js";

function createRemoteStorage() {
  const data = {};
  return {
    async get(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? { value: data[key] } : null;
    },
    async set(key, value) {
      data[key] = value;
      return true;
    },
    async delete(key) {
      delete data[key];
      return true;
    },
    async list(prefix = "") {
      return { keys: Object.keys(data).filter((key) => key.startsWith(prefix)) };
    }
  };
}

function createLocalStorage() {
  return createRemoteStorage();
}

describe("app storage adapter", () => {
  it("clears expired CMMS PIN auth tokens that cannot be refreshed", () => {
    expect(shouldClearExpiredNonRefreshAuth({
      accessToken: "cmms-pin-token",
      refreshToken: null,
      expiresAt: 1_000
    }, 2_000)).toBe(true);
  });

  it("keeps refreshable production auth for the normal refresh path", () => {
    expect(shouldClearExpiredNonRefreshAuth({
      accessToken: "supabase-token",
      refreshToken: "refresh-token",
      expiresAt: 1_000
    }, 2_000)).toBe(false);
  });

  it("keeps non-expiring local auth values available", () => {
    expect(shouldClearExpiredNonRefreshAuth({
      accessToken: "legacy-token",
      refreshToken: null,
      expiresAt: 0
    }, 2_000)).toBe(false);
  });

  it("keeps the default shared write timeout long enough for server-backed staging", () => {
    expect(DEFAULT_SHARED_STORAGE_TIMEOUT_MS).toBeGreaterThanOrEqual(8000);
  });

  it("uses memory before the external storage provider is available", async () => {
    let remote = null;
    const store = createAppStore({ storageProvider: () => remote });

    await expect(store.set("ticket:1", "local", true)).resolves.toBe(true);
    await expect(store.get("ticket:1", true)).resolves.toBe("local");
    await expect(store.list("ticket:", true)).resolves.toEqual(["ticket:1"]);
  });

  it("resolves the external storage provider lazily after store creation", async () => {
    let remote = null;
    const store = createAppStore({ storageProvider: () => remote });

    remote = createRemoteStorage();
    await expect(store.set("ticket:2", "remote", true)).resolves.toBe(true);
    await expect(store.get("ticket:2", true)).resolves.toBe("remote");
    await expect(store.list("ticket:", true)).resolves.toEqual(["ticket:2"]);
  });

  it("loads key values in one provider call when the storage supports it", async () => {
    const remote = {
      listValues: vi.fn().mockResolvedValue({
        records: [{ key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }]
      }),
      get: vi.fn()
    };
    const store = createAppStore({
      storageProvider: () => remote,
      allowMemoryFallback: false
    });

    await expect(store.listValues("ticket:", true)).resolves.toEqual([
      { key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }
    ]);
    expect(remote.listValues).toHaveBeenCalledWith("ticket:", true);
    expect(remote.get).not.toHaveBeenCalled();
  });

  it("loads multiple collections in one provider call when supported", async () => {
    const remote = {
      listManyValues: vi.fn().mockResolvedValue({
        collections: {
          "ticket:": [{ key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }],
          "fleet:": [{ key: "fleet:1", value: "{\"id\":\"fleet-1\"}" }]
        }
      }),
      listValues: vi.fn()
    };
    const store = createAppStore({
      storageProvider: () => remote,
      allowMemoryFallback: false
    });

    await expect(store.listManyValues(["ticket:", "fleet:"], true)).resolves.toEqual({
      "ticket:": [{ key: "ticket:1", value: "{\"id\":\"ticket-1\"}" }],
      "fleet:": [{ key: "fleet:1", value: "{\"id\":\"fleet-1\"}" }]
    });
    expect(remote.listManyValues).toHaveBeenCalledWith(["ticket:", "fleet:"], true);
    expect(remote.listValues).not.toHaveBeenCalled();
  });

  it("saves multiple shared records in one provider call when supported", async () => {
    const remote = {
      setMany: vi.fn().mockResolvedValue(true),
      set: vi.fn()
    };
    const store = createAppStore({
      storageProvider: () => remote,
      allowMemoryFallback: false
    });
    const records = [
      { key: "fleet:1", value: "{\"id\":\"fleet-1\"}" },
      { key: "fleet:2", value: "{\"id\":\"fleet-2\"}" }
    ];

    await expect(store.setMany(records, true)).resolves.toBe(true);

    expect(remote.setMany).toHaveBeenCalledWith(records, true, {});
    expect(remote.set).not.toHaveBeenCalled();
  });

  it("passes atomic batch options to shared storage", async () => {
    const remote = {
      setMany: vi.fn().mockResolvedValue(true)
    };
    const store = createAppStore({
      storageProvider: () => remote,
      allowMemoryFallback: false
    });
    const records = [{ key: "fleet:1", value: "{}" }];

    await expect(store.setMany(records, true, { atomic: true, timeoutMs: 5000 })).resolves.toBe(true);

    expect(remote.setMany).toHaveBeenCalledWith(records, true, { atomic: true, timeoutMs: 5000 });
  });

  it("reports a single shared failure when batch save times out", async () => {
    const onFail = vi.fn();
    const store = createAppStore({
      storageProvider: () => ({ setMany: () => new Promise(() => {}) }),
      timeoutMs: 1,
      allowMemoryFallback: false
    });
    store._onFail = onFail;

    await expect(store.setMany([{ key: "fleet:1", value: "{}" }], true)).resolves.toBe(false);

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(expect.objectContaining({
      operation: "setMany",
      key: "fleet:1"
    }));
  });

  it("keeps non-shared browser keys local even when shared storage is remote", async () => {
    const remote = createRemoteStorage();
    const local = createLocalStorage();
    const store = createAppStore({
      storageProvider: () => remote,
      localStorageProvider: () => local,
      allowMemoryFallback: false
    });

    await expect(store.set("theme:v1", "dark", false)).resolves.toBe(true);
    await expect(store.set("ticket:1", "remote", true)).resolves.toBe(true);

    await expect(store.get("theme:v1", false)).resolves.toBe("dark");
    await expect(store.get("theme:v1", true)).resolves.toBe(null);
    await expect(store.get("ticket:1", true)).resolves.toBe("remote");
    await expect(store.get("ticket:1", false)).resolves.toBe(null);
  });

  it("keeps a local fallback and reports save failure when external storage times out", async () => {
    const onFail = vi.fn();
    const store = createAppStore({
      storageProvider: () => ({ set: () => new Promise(() => {}) }),
      timeoutMs: 1
    });
    store._onFail = onFail;

    await expect(store.set("ticket:3", "fallback", true)).resolves.toBe(false);
    await expect(store.get("ticket:3", true)).resolves.toBe("fallback");
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("does not show the global save failure toast for local browser keys", async () => {
    const onFail = vi.fn();
    const store = createAppStore({
      localStorageProvider: () => ({ set: () => new Promise(() => {}) }),
      timeoutMs: 1,
      allowMemoryFallback: false
    });
    store._onFail = onFail;

    await expect(store.set("login:v1", "remembered", false)).resolves.toBe(false);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("keeps production write failures visible without warning on read refresh failures", async () => {
    const onFail = vi.fn();
    const never = () => new Promise(() => {});
    const store = createAppStore({
      storageProvider: () => ({ get: never, set: never, list: never }),
      timeoutMs: 1,
      allowMemoryFallback: false
    });
    store._onFail = onFail;

    await expect(store.set("ticket:4", "lost-if-fallback", true)).resolves.toBe(false);
    await expect(store.get("ticket:4", true)).rejects.toThrow("timeout");
    await expect(store.list("ticket:", true)).rejects.toThrow("timeout");
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(expect.objectContaining({ operation: "set" }));
  });
});
