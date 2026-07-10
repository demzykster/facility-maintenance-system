const knownCompatibilityMirrors = new Set([
  "appIssue",
  "config",
  "cround",
  "czone",
  "fleet",
  "ppeitem",
  "ppenorm",
  "ppereq",
  "presence",
  "pushSubscriptions",
  "ticket",
  "user"
]);

const knownDeferredOrphanCandidates = new Set([
  "controlAssignment",
  "controlFinding",
  "controlProgram",
  "controlRun",
  "itpl"
]);

const knownTransientOperational = new Set([
  "publicComplaintRate"
]);

export function prefixFromRecordKey(key = "") {
  const clean = String(key || "").trim();
  const index = clean.indexOf(":");
  return index >= 0 ? clean.slice(0, index) : clean;
}

export function countKvPrefixes(recordKeys = []) {
  return recordKeys.reduce((counts, key) => {
    const prefix = prefixFromRecordKey(key);
    if (!prefix) return counts;
    counts[prefix] = (counts[prefix] || 0) + 1;
    return counts;
  }, {});
}

export function classifyKvResiduals({ kvPrefixes = {}, userReconciliation = null } = {}) {
  const compatibilityMirrors = [];
  const transientOperational = [];
  const deferredOrphanCandidates = [];
  const unknown = [];

  for (const [prefix, count] of Object.entries(kvPrefixes).sort(([a], [b]) => a.localeCompare(b))) {
    const item = { prefix, count };
    if (knownCompatibilityMirrors.has(prefix)) {
      compatibilityMirrors.push({
        ...item,
        status: prefix === "user" && userReconciliation?.counts
          ? `matched:${userReconciliation.counts.matched}/${userReconciliation.counts.legacyUsers}`
          : "compatibility_mirror"
      });
    } else if (knownTransientOperational.has(prefix)) {
      transientOperational.push({ ...item, status: "transient_operational" });
    } else if (knownDeferredOrphanCandidates.has(prefix)) {
      deferredOrphanCandidates.push({ ...item, status: "deferred_or_orphan_candidate" });
    } else {
      unknown.push({ ...item, status: "unknown" });
    }
  }

  return {
    ok: true,
    counts: {
      prefixes: Object.keys(kvPrefixes).length,
      compatibilityMirrors: compatibilityMirrors.reduce((sum, item) => sum + item.count, 0),
      transientOperational: transientOperational.reduce((sum, item) => sum + item.count, 0),
      deferredOrphanCandidates: deferredOrphanCandidates.reduce((sum, item) => sum + item.count, 0),
      unknown: unknown.reduce((sum, item) => sum + item.count, 0)
    },
    compatibilityMirrors,
    transientOperational,
    deferredOrphanCandidates,
    unknown
  };
}
