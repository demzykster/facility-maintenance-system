export const VERSION_MANIFEST_PATH = "/cmms-version.json";

export function normalizeBuildCommit(value) {
  const commit = String(value || "").trim();
  if (!commit || commit === "local" || commit === "unknown") return "";
  return commit.slice(0, 40);
}

export function normalizeVersionManifest(value = {}) {
  return {
    commit: normalizeBuildCommit(value.commit),
    buildTime: String(value.buildTime || "").trim(),
    version: String(value.version || "").trim()
  };
}

export function shouldShowVersionUpdate({ currentCommit, latestCommit, dismissedCommit } = {}) {
  const current = normalizeBuildCommit(currentCommit);
  const latest = normalizeBuildCommit(latestCommit);
  const dismissed = normalizeBuildCommit(dismissedCommit);
  if (!current || !latest) return false;
  if (current === latest) return false;
  return latest !== dismissed;
}
