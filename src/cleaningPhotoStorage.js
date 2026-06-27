import { createApiFileProvider } from "./apiFileAdapter.js";
import { createProductionAuthStore } from "./productionLoginAdapter.js";
import { storageApiBaseUrlFromEnv, storageProviderFromEnv, STORAGE_PROVIDERS } from "./storageProviderModel.js";

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

const asDataUrl = (file = {}) => {
  if (!file?.data) return null;
  if (/^data:/i.test(file.data)) return file.data;
  return `data:${file.contentType || "application/octet-stream"};base64,${file.data}`;
};

const safeSegment = (value) => String(value || "item").replace(/[^a-zA-Z0-9._-]/g, "-");

export const cleaningComplaintPhotoPath = (complaintId, dataUrl = "") => (
  `cleaning/complaints/${safeSegment(complaintId)}/photo.${dataUrlMeta(dataUrl).ext}`
);

export const cleaningComplaintIssuePhotoPath = (complaintId, issue, index, dataUrl = "") => (
  `cleaning/complaints/${safeSegment(complaintId)}/issues/${safeSegment(issue?.id || issue?.itemId || `issue-${index + 1}`)}.${dataUrlMeta(dataUrl).ext}`
);

export const cleaningRoundIssuePhotoPath = (roundId, issue, index, dataUrl = "") => (
  `cleaning/rounds/${safeSegment(roundId)}/issues/${safeSegment(issue?.id || issue?.itemId || `issue-${index + 1}`)}.${dataUrlMeta(dataUrl).ext}`
);

export function createCleaningPhotoStorage({ appMode = "demo", provider = STORAGE_PROVIDERS.local, apiBaseUrl = "", authStore = null, apiProvider = null } = {}) {
  const useApi = appMode === "production" && provider === STORAGE_PROVIDERS.api && apiBaseUrl;
  const files = apiProvider || (useApi ? createApiFileProvider({
    baseUrl: apiBaseUrl,
    getAccessToken: () => authStore?.get?.()?.accessToken || ""
  }) : null);

  const savePhoto = async (path, photo) => {
    if (!photo || !files) return null;
    await files.upload(path, { data: photo, contentType: dataUrlMeta(photo).contentType });
    return path;
  };

  const saveIssues = async (ownerId, issues = [], pathBuilder) => {
    if (!Array.isArray(issues)) return issues;
    const out = [];
    for (const [index, issue] of issues.entries()) {
      if (!issue?.photo) {
        out.push(issue);
        continue;
      }
      const photoPath = await savePhoto(pathBuilder(ownerId, issue, index, issue.photo), issue.photo);
      out.push({ ...issue, photo: null, photoPath, hasPhoto: true });
    }
    return out;
  };

  return {
    usesApi: !!(useApi && files),
    async saveComplaint(complaint) {
      if (!this.usesApi || !complaint?.id) return complaint;
      const rec = { ...complaint };
      if (rec.photo) {
        rec.photoPath = await savePhoto(cleaningComplaintPhotoPath(rec.id, rec.photo), rec.photo);
        rec.photo = null;
        rec.hasPhoto = true;
      }
      rec.issues = await saveIssues(rec.id, rec.issues || [], cleaningComplaintIssuePhotoPath);
      return rec;
    },
    async saveRound(round) {
      if (!this.usesApi || !round?.id) return round;
      return {
        ...round,
        issues: await saveIssues(round.id, round.issues || [], cleaningRoundIssuePhotoPath)
      };
    },
    async load(record) {
      if (record?.photo) return record.photo;
      if (!this.usesApi || !record?.photoPath) return null;
      try {
        return asDataUrl(await files.download(record.photoPath));
      } catch {
        return null;
      }
    }
  };
}

export function createCleaningPhotoStorageFromEnv(env = {}, authStore = createProductionAuthStore()) {
  return createCleaningPhotoStorage({
    appMode: String(env.VITE_CMMS_APP_MODE || "demo").trim().toLowerCase(),
    provider: storageProviderFromEnv(env),
    apiBaseUrl: storageApiBaseUrlFromEnv(env),
    authStore
  });
}
