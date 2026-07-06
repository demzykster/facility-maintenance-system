import { createApiFileProvider } from "./apiFileAdapter.js";
import { cleaningComplaintIssuePhotoMetadata, cleaningComplaintPhotoMetadata, cleaningRoundIssuePhotoMetadata } from "./fileMetadataModel.js";
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

const recordPhotoPaths = (record = {}) => {
  const paths = [];
  if (record.photoPath) paths.push(record.photoPath);
  for (const issue of record.issues || []) {
    if (issue?.photoPath) paths.push(issue.photoPath);
  }
  return [...new Set(paths)];
};

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

  const savePhoto = async (path, photo, metadata = null) => {
    if (!photo || !files) return null;
    const contentType = dataUrlMeta(photo).contentType;
    await files.upload(path, { data: photo, contentType, ...(metadata ? { metadata } : {}) });
    return path;
  };

  const saveIssues = async (owner, issues = [], pathBuilder, metadataBuilder = null) => {
    if (!Array.isArray(issues)) return issues;
    const ownerId = owner?.id || owner;
    const out = [];
    for (const [index, issue] of issues.entries()) {
      if (!issue?.photo) {
        out.push(issue);
        continue;
      }
      const photoPath = pathBuilder(ownerId, issue, index, issue.photo);
      const metadata = metadataBuilder ? metadataBuilder(owner, issue, photoPath, {
        contentType: dataUrlMeta(issue.photo).contentType
      }) : null;
      await savePhoto(photoPath, issue.photo, metadata);
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
        const photoPath = cleaningComplaintPhotoPath(rec.id, rec.photo);
        rec.photoPath = await savePhoto(photoPath, rec.photo, cleaningComplaintPhotoMetadata(rec, photoPath, {
          contentType: dataUrlMeta(rec.photo).contentType
        }));
        rec.photo = null;
        rec.hasPhoto = true;
      }
      rec.issues = await saveIssues(rec, rec.issues || [], cleaningComplaintIssuePhotoPath, cleaningComplaintIssuePhotoMetadata);
      return rec;
    },
    async saveRound(round) {
      if (!this.usesApi || !round?.id) return round;
      return {
        ...round,
        issues: await saveIssues(round, round.issues || [], cleaningRoundIssuePhotoPath, cleaningRoundIssuePhotoMetadata)
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
    },
    async removeRecord(record) {
      if (!this.usesApi) return;
      for (const path of recordPhotoPaths(record)) {
        try { await files.delete(path); } catch {}
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
