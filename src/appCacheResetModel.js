export const PRESERVED_LOCAL_STORAGE_KEYS = Object.freeze([
  "cmms:productionAuth:v1",
  "session:v1",
  "login:v1",
  "language:v1",
  "theme:v1"
]);

export const RESETTABLE_LOCAL_STORAGE_PREFIXES = Object.freeze([
  "dashboardWidgets:",
  "notifprefs:",
  "seen:"
]);

export const RESETTABLE_LOCAL_STORAGE_KEYS = Object.freeze([
  "anonrl"
]);

export function shouldPreserveLocalStorageKey(key = "") {
  return PRESERVED_LOCAL_STORAGE_KEYS.includes(String(key));
}

export function shouldResetLocalStorageKey(key = "") {
  const normalized = String(key || "");
  if (!normalized || shouldPreserveLocalStorageKey(normalized)) return false;
  if (RESETTABLE_LOCAL_STORAGE_KEYS.includes(normalized)) return true;
  return RESETTABLE_LOCAL_STORAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function removableLocalStorageKeys(storage) {
  const keys = [];
  const length = Number(storage?.length || 0);
  for (let index = 0; index < length; index += 1) {
    const key = storage.key?.(index);
    if (shouldResetLocalStorageKey(key)) keys.push(key);
  }
  return keys;
}

export async function clearNamedCaches(cacheStorage) {
  if (!cacheStorage?.keys || !cacheStorage?.delete) return [];
  const names = await cacheStorage.keys();
  const deleted = [];
  for (const name of names) {
    if (await cacheStorage.delete(name)) deleted.push(name);
  }
  return deleted;
}

export async function updateServiceWorkers(serviceWorkerContainer) {
  if (!serviceWorkerContainer?.getRegistrations) return 0;
  const registrations = await serviceWorkerContainer.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.update?.()));
  return registrations.length;
}

export async function softResetAppCache({
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  caches = globalThis.caches,
  serviceWorker = globalThis.navigator?.serviceWorker
} = {}) {
  const removedLocalStorageKeys = removableLocalStorageKeys(localStorage);
  removedLocalStorageKeys.forEach((key) => localStorage?.removeItem?.(key));

  const removedSessionStorageKeys = removableLocalStorageKeys(sessionStorage);
  removedSessionStorageKeys.forEach((key) => sessionStorage?.removeItem?.(key));

  const removedCaches = await clearNamedCaches(caches);
  const updatedServiceWorkers = await updateServiceWorkers(serviceWorker);

  return {
    removedLocalStorageKeys,
    removedSessionStorageKeys,
    removedCaches,
    updatedServiceWorkers
  };
}
