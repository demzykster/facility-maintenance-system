import { createApiFileProvider } from "./apiFileAdapter.js";
import { ticketPhotoMetadata } from "./fileMetadataModel.js";
import { createProductionAuthStore } from "./productionLoginAdapter.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv, STORAGE_PROVIDERS } from "./storageProviderModel.js";

const PHOTO_META = {
  before: { legacyKey: (id) => `photo:${id}`, pathField: "photoPath", hasField: "hasPhoto", name: "before" },
  after: { legacyKey: (id) => `photo:after:${id}`, pathField: "afterPhotoPath", hasField: "hasAfterPhoto", name: "after" }
};

const imageExt = (contentType = "") => {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  return "jpg";
};

const dataUrlMeta = (dataUrl = "") => {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,/i);
  const contentType = match?.[1] || "image/jpeg";
  return { contentType, ext: imageExt(contentType) };
};

export const ticketPhotoPath = (ticketId, kind, dataUrl = "") => {
  const meta = PHOTO_META[kind] || PHOTO_META.before;
  return `tickets/${ticketId}/${meta.name}.${dataUrlMeta(dataUrl).ext}`;
};

const asDataUrl = (file = {}) => {
  if (!file?.data) return null;
  if (/^data:/i.test(file.data)) return file.data;
  return `data:${file.contentType || "application/octet-stream"};base64,${file.data}`;
};

export function createTicketPhotoStorage({ appMode = "demo", provider = STORAGE_PROVIDERS.local, apiBaseUrl = "", authStore = null, appStore = null, apiProvider = null } = {}) {
  const useApi = appMode === "production" && provider === STORAGE_PROVIDERS.api && apiBaseUrl;
  const files = apiProvider || (useApi ? createApiFileProvider({
    baseUrl: apiBaseUrl,
    getAccessToken: () => authStore?.get?.()?.accessToken || ""
  }) : null);

  return {
    usesApi: !!(useApi && files),
    async save(ticketId, kind, dataUrl) {
      const meta = PHOTO_META[kind] || PHOTO_META.before;
      if (!dataUrl) return {};
      if (this.usesApi) {
        const path = ticketPhotoPath(ticketId, kind, dataUrl);
        const contentType = dataUrlMeta(dataUrl).contentType;
        await files.upload(path, {
          data: dataUrl,
          contentType,
          metadata: ticketPhotoMetadata({ id: ticketId }, kind, path, { contentType })
        });
        return { [meta.hasField]: true, [meta.pathField]: path };
      }
      await appStore?.set?.(meta.legacyKey(ticketId), dataUrl, true);
      return { [meta.hasField]: true };
    },
    async load(ticket, kind) {
      const meta = PHOTO_META[kind] || PHOTO_META.before;
      if (!ticket?.[meta.hasField]) return null;
      if (this.usesApi && ticket?.[meta.pathField]) {
        try {
          return asDataUrl(await files.download(ticket[meta.pathField]));
        } catch {}
      }
      return appStore?.get?.(meta.legacyKey(ticket.id), true) || null;
    },
    async remove(ticketOrId) {
      const id = typeof ticketOrId === "string" ? ticketOrId : ticketOrId?.id;
      if (!id) return;
      for (const meta of Object.values(PHOTO_META)) {
        const storedPath = typeof ticketOrId === "object" ? ticketOrId?.[meta.pathField] : "";
        try { await appStore?.del?.(meta.legacyKey(id), true); } catch {}
        if (this.usesApi) {
          try { await files.delete(storedPath || `tickets/${id}/${meta.name}.jpg`); } catch {}
          try { await files.delete(`tickets/${id}/${meta.name}.png`); } catch {}
          try { await files.delete(`tickets/${id}/${meta.name}.webp`); } catch {}
        }
      }
    }
  };
}

export function createTicketPhotoStorageFromEnv(env = {}, appStore, authStore = createProductionAuthStore()) {
  return createTicketPhotoStorage({
    appMode: String(env.VITE_CMMS_APP_MODE || "demo").trim().toLowerCase(),
    provider: storageProviderFromEnv(env),
    apiBaseUrl: storageApiBaseUrlFromEnv(env),
    authStore,
    appStore
  });
}
