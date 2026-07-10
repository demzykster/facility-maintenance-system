const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const digits = (value) => clean(value).replace(/\D/g, "");

export function parseLegacyUserRecord(row = {}) {
  const key = clean(row.record_key || row.key);
  const raw = row.value ?? row.record_value ?? "";
  try {
    const user = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    return user && typeof user === "object" ? { key, user } : null;
  } catch {
    return { key, user: null, parseError: true };
  }
}

export function appUserMatchReasons(legacy = {}, appUser = {}) {
  const reasons = [];
  if (legacy.id && legacy.id === appUser.id) reasons.push("id");
  if (legacy.authUserId && legacy.authUserId === appUser.auth_user_id) reasons.push("authUserId");
  if (lower(legacy.email) && lower(legacy.email) === lower(appUser.email)) reasons.push("email");
  if (clean(legacy.workerNo) && clean(legacy.workerNo) === clean(appUser.worker_no)) reasons.push("workerNo");
  if (digits(legacy.phone) && digits(legacy.phone) === digits(appUser.phone)) reasons.push("phone");
  return reasons;
}

export function reconcileLegacyUsers({ legacyRows = [], appUsers = [] } = {}) {
  const parsedLegacy = legacyRows.map(parseLegacyUserRecord).filter(Boolean);
  const legacy = [];
  const matched = [];
  const ambiguous = [];
  const legacyOnly = [];
  const parseErrors = [];

  for (const record of parsedLegacy) {
    if (record.parseError || !record.user) {
      parseErrors.push({ key: record.key });
      continue;
    }
    legacy.push(record);
    const candidates = (appUsers || [])
      .map((appUser) => ({ appUser, reasons: appUserMatchReasons(record.user, appUser) }))
      .filter((candidate) => candidate.reasons.length);
    const item = {
      key: record.key,
      id: record.user.id || "",
      name: record.user.name || "",
      role: record.user.role || "",
      active: record.user.active !== false,
      hasEmail: !!lower(record.user.email),
      hasWorkerNo: !!clean(record.user.workerNo),
      hasPhone: !!digits(record.user.phone)
    };
    if (candidates.length === 1) {
      matched.push({
        ...item,
        appUserId: candidates[0].appUser.id || "",
        appUserName: candidates[0].appUser.name || "",
        reasons: candidates[0].reasons
      });
    } else if (candidates.length > 1) {
      ambiguous.push({
        ...item,
        candidates: candidates.map((candidate) => ({
          appUserId: candidate.appUser.id || "",
          appUserName: candidate.appUser.name || "",
          reasons: candidate.reasons
        }))
      });
    } else {
      legacyOnly.push(item);
    }
  }

  return {
    ok: true,
    counts: {
      legacyUsers: legacy.length,
      appUsers: (appUsers || []).length,
      matched: matched.length,
      ambiguous: ambiguous.length,
      legacyOnly: legacyOnly.length,
      parseErrors: parseErrors.length
    },
    matched,
    ambiguous,
    legacyOnly,
    parseErrors
  };
}
