const cleanString = (value) => String(value || "").trim();

export function kvMirrorRetirementPlan({ prefix = "", kvRows = [], normalizedRows = [] } = {}) {
  const cleanPrefix = cleanString(prefix);
  const sourceKeys = new Set(
    (normalizedRows || [])
      .map((row) => cleanString(row.source_kv_key || row.sourceKvKey))
      .filter(Boolean)
  );
  const rows = (kvRows || [])
    .map((row) => ({
      scope: cleanString(row.scope),
      recordKey: cleanString(row.record_key || row.key),
      value: row.value
    }))
    .filter((row) => row.recordKey && (!cleanPrefix || row.recordKey.startsWith(cleanPrefix)));
  const matched = rows.filter((row) => row.scope === "shared" && sourceKeys.has(row.recordKey));
  const notShared = rows.filter((row) => row.scope !== "shared");
  const notMatched = rows.filter((row) => row.scope === "shared" && !sourceKeys.has(row.recordKey));

  return {
    prefix: cleanPrefix,
    counts: {
      kv: rows.length,
      normalizedSourceKeys: sourceKeys.size,
      matched: matched.length,
      notMatched: notMatched.length,
      notShared: notShared.length
    },
    matched: matched.map((row) => row.recordKey).sort(),
    notMatched: notMatched.map((row) => row.recordKey).sort(),
    notShared: notShared.map((row) => ({ scope: row.scope, recordKey: row.recordKey })).sort((a, b) => a.recordKey.localeCompare(b.recordKey))
  };
}
