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

const defaultLocalStorageProvider = () => {
  const local = globalThis.localStorage;
  if (!local) return null;
  return {
    async get(key) {
      const value = local.getItem(key);
      return value == null ? null : { value };
    },
    async set(key, value) {
      local.setItem(key, value);
      return true;
    },
    async delete(key) {
      local.removeItem(key);
      return true;
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < local.length; i += 1) {
        const key = local.key(i);
        if (key && key.startsWith(prefix)) keys.push(key);
      }
      return { keys };
    }
  };
};

const defaultAllowMemoryFallback = () => storageProviderFromEnv(importEnv()) !== STORAGE_PROVIDERS.api;

export const withTimeout = (promise, ms = 2000) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve(undefined), ms))
]);

export function createAppStore({ storageProvider = defaultStorageProvider, localStorageProvider = defaultLocalStorageProvider, timeoutMs = 2000, allowMemoryFallback = defaultAllowMemoryFallback } = {}) {
  const mem = {};
  const canUseMemoryFallback = () => typeof allowMemoryFallback === "function" ? !!allowMemoryFallback() : !!allowMemoryFallback;
  const resolveStorage = (shared) => shared ? storageProvider() : localStorageProvider();
  const notifyFail = () => { try { store._onFail && store._onFail(); } catch (_) {} };
  const store = {
    async get(key, shared = false) {
      const fallback = canUseMemoryFallback();
      try {
        const storage = resolveStorage(shared);
        if (storage) {
          const result = await withTimeout(storage.get(key, shared), timeoutMs);
          if (result === undefined) throw new Error("timeout");
          if (result !== undefined) return result ? result.value : null;
        }
      } catch (e) {
        if (!fallback) { notifyFail(); throw e; }
      }
      return fallback && Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    },
    async set(key, value, shared = false) {
      const fallback = canUseMemoryFallback();
      if (fallback) mem[key] = value;
      const storage = resolveStorage(shared);
      if (!storage) return fallback;
      try {
        const result = await withTimeout(storage.set(key, value, shared), timeoutMs);
        if (result === undefined) throw new Error("timeout");
        return true;
      } catch (e) {
        notifyFail();
        return false;
      }
    },
    async del(key, shared = false) {
      const fallback = canUseMemoryFallback();
      if (fallback) delete mem[key];
      const storage = resolveStorage(shared);
      if (!storage) return fallback;
      try {
        const result = await withTimeout(storage.delete(key, shared), timeoutMs);
        if (result === undefined) throw new Error("timeout");
        return true;
      } catch (e) {
        notifyFail();
        return false;
      }
    },
    async list(prefix, shared = false) {
      const fallback = canUseMemoryFallback();
      try {
        const storage = resolveStorage(shared);
        if (storage) {
          const result = await withTimeout(storage.list(prefix, shared), timeoutMs);
          if (result === undefined) throw new Error("timeout");
          if (result !== undefined) return result ? result.keys : [];
        }
      } catch (e) {
        if (!fallback) { notifyFail(); throw e; }
      }
      return fallback ? Object.keys(mem).filter((key) => key.startsWith(prefix)) : [];
    }
  };
  return store;
}

export const store = createAppStore();
