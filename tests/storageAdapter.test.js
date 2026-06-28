import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "../src/storageAdapter.js";

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

describe("app storage adapter", () => {
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

  it("can disable memory fallback for production API storage", async () => {
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
    expect(onFail).toHaveBeenCalledTimes(3);
  });
});
