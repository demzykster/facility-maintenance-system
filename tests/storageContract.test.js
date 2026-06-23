import { describe, expect, it } from "vitest";

const storagePrefix = "facility-maintenance:";

function createMemoryLocalStorage() {
  const items = new Map();

  return {
    get length() {
      return items.size;
    },
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
    key(index) {
      return [...items.keys()][index] ?? null;
    }
  };
}

function createStorageHarness(localStorage) {
  return {
    async get(key) {
      const value = localStorage.getItem(storagePrefix + key);
      return value === null ? null : { value };
    },
    async set(key, value) {
      localStorage.setItem(storagePrefix + key, value);
      return true;
    },
    async delete(key) {
      localStorage.removeItem(storagePrefix + key);
      return true;
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const rawKey = localStorage.key(i);
        if (rawKey?.startsWith(storagePrefix + prefix)) {
          keys.push(rawKey.slice(storagePrefix.length));
        }
      }
      return { keys };
    }
  };
}

describe("storage adapter contract", () => {
  it("gets, sets, deletes, and lists keys using the app storage prefix", async () => {
    const localStorage = createMemoryLocalStorage();
    const storage = createStorageHarness(localStorage);

    await expect(storage.get("ticket:1", true)).resolves.toBeNull();
    await expect(storage.set("ticket:1", "open", true)).resolves.toBe(true);
    await expect(storage.get("ticket:1", true)).resolves.toEqual({ value: "open" });

    await storage.set("ticket:2", "closed", true);
    await storage.set("user:1", "admin", true);
    localStorage.setItem("other-app:ticket:3", "ignored");

    await expect(storage.list("ticket:", true)).resolves.toEqual({
      keys: ["ticket:1", "ticket:2"]
    });
    await expect(storage.delete("ticket:1", true)).resolves.toBe(true);
    await expect(storage.get("ticket:1", true)).resolves.toBeNull();
  });
});
