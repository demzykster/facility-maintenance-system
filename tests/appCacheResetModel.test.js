import { describe, expect, it, vi } from "vitest";
import {
  clearNamedCaches,
  removableLocalStorageKeys,
  shouldPreserveLocalStorageKey,
  shouldResetLocalStorageKey,
  softResetAppCache,
  updateServiceWorkers
} from "../src/appCacheResetModel.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return [...map.keys()][index] || null;
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    }
  };
}

describe("appCacheResetModel", () => {
  it("preserves auth, session, language and theme keys", () => {
    expect(shouldPreserveLocalStorageKey("cmms:productionAuth:v1")).toBe(true);
    expect(shouldPreserveLocalStorageKey("session:v1")).toBe(true);
    expect(shouldPreserveLocalStorageKey("language:v1")).toBe(true);
    expect(shouldPreserveLocalStorageKey("theme:v1")).toBe(true);
    expect(shouldResetLocalStorageKey("cmms:productionAuth:v1")).toBe(false);
  });

  it("only removes local UI state, not shared business data", () => {
    const storage = fakeStorage({
      "cmms:productionAuth:v1": "auth",
      "language:v1": "he",
      "theme:v1": "dark",
      "fleet:abc": "{}",
      "ticket:def": "{}",
      "dashboardWidgets:admin": "{}",
      "notifprefs:admin": "{}",
      "seen:admin:Vadim": "{}",
      anonrl: "123"
    });

    expect(removableLocalStorageKeys(storage).sort()).toEqual([
      "anonrl",
      "dashboardWidgets:admin",
      "notifprefs:admin",
      "seen:admin:Vadim"
    ]);
  });

  it("clears browser caches and updates service workers without unregistering push", async () => {
    const deleted = [];
    const caches = {
      keys: vi.fn(async () => ["vite", "cmms-assets"]),
      delete: vi.fn(async (name) => {
        deleted.push(name);
        return true;
      })
    };
    const update = vi.fn(async () => {});
    const serviceWorker = {
      getRegistrations: vi.fn(async () => [{ update }, { update }])
    };

    await expect(clearNamedCaches(caches)).resolves.toEqual(["vite", "cmms-assets"]);
    await expect(updateServiceWorkers(serviceWorker)).resolves.toBe(2);
    expect(deleted).toEqual(["vite", "cmms-assets"]);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("performs a soft reset without logging the user out", async () => {
    const localStorage = fakeStorage({
      "cmms:productionAuth:v1": "auth",
      "session:v1": "session",
      "login:v1": "login",
      "language:v1": "ru",
      "theme:v1": "dark",
      "dashboardWidgets:admin": "{}",
      "notifprefs:admin": "{}",
      "fleet:abc": "{}"
    });
    const sessionStorage = fakeStorage({
      "cmms:productionAuth:v1": "auth-session",
      "seen:admin:Vadim": "{}"
    });

    const result = await softResetAppCache({
      localStorage,
      sessionStorage,
      caches: { keys: async () => [], delete: async () => true },
      serviceWorker: { getRegistrations: async () => [] }
    });

    expect(result.removedLocalStorageKeys.sort()).toEqual(["dashboardWidgets:admin", "notifprefs:admin"]);
    expect(result.removedSessionStorageKeys).toEqual(["seen:admin:Vadim"]);
    expect(localStorage.snapshot()).toEqual({
      "cmms:productionAuth:v1": "auth",
      "session:v1": "session",
      "login:v1": "login",
      "language:v1": "ru",
      "theme:v1": "dark",
      "fleet:abc": "{}"
    });
    expect(sessionStorage.snapshot()).toEqual({
      "cmms:productionAuth:v1": "auth-session"
    });
  });
});
