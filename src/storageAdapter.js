import { createApiStorageProvider } from "./apiStorageAdapter.js";
import { createProductionAuthStore } from "./productionLoginAdapter.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv, STORAGE_PROVIDERS } from "./storageProviderModel.js";

const importEnv = () => import.meta.env || {};
const productionAuthStore = createProductionAuthStore();

const apiProvider = () => createApiStorageProvider({
  baseUrl: storageApiBaseUrlFromEnv(importEnv()),
  getAccessToken: () => productionAuthStore.get()?.accessToken || ""
});

const defaultStorageProvider = () => (
  storageProviderFromEnv(importEnv()) === STORAGE_PROVIDERS.api
    ? apiProvider()
    : (typeof window !== "undefined" ? window.storage : null)
);

export const withTimeout = (promise, ms = 2000) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve(undefined), ms))
]);

export function createAppStore({ storageProvider = defaultStorageProvider, timeoutMs = 2000 } = {}) {
  const mem = {};
  const store = {
    async get(key, shared = false) {
      try {
        const storage = storageProvider();
        if (storage) {
          const result = await withTimeout(storage.get(key, shared), timeoutMs);
          if (result !== undefined) return result ? result.value : null;
        }
      } catch (e) {}
      return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    },
    async set(key, value, shared = false) {
      mem[key] = value;
      const storage = storageProvider();
      if (!storage) return true;
      try {
        const result = await withTimeout(storage.set(key, value, shared), timeoutMs);
        if (result === undefined) throw new Error("timeout");
        return true;
      } catch (e) {
        try { store._onFail && store._onFail(); } catch (_) {}
        return false;
      }
    },
    async del(key, shared = false) {
      delete mem[key];
      const storage = storageProvider();
      if (!storage) return true;
      try {
        const result = await withTimeout(storage.delete(key, shared), timeoutMs);
        if (result === undefined) throw new Error("timeout");
        return true;
      } catch (e) {
        try { store._onFail && store._onFail(); } catch (_) {}
        return false;
      }
    },
    async list(prefix, shared = false) {
      try {
        const storage = storageProvider();
        if (storage) {
          const result = await withTimeout(storage.list(prefix, shared), timeoutMs);
          if (result !== undefined) return result ? result.keys : [];
        }
      } catch (e) {}
      return Object.keys(mem).filter((key) => key.startsWith(prefix));
    }
  };
  return store;
}

export const store = createAppStore();
