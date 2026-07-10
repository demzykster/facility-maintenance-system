const clean = (value) => String(value || "").trim();
const lower = (value) => clean(value).toLowerCase();
const digits = (value) => clean(value).replace(/\D/g, "");
const cleanArray = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const numberOrNull = (value) => value === null || value === undefined || value === "" ? null : Math.max(0, Number(value) || 0);
const timestampOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const ts = Number(value);
  return Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
};
const passwordRoles = new Set(["admin", "user"]);
const workerNoRoles = new Set(["worker", "cleaner"]);
const techScopes = new Set(["transport", "facility", "both"]);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower(value));

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

export function appUserBackfillRowFromLegacyUser(item = {}) {
  const legacy = item.user || item;
  const role = clean(legacy.role) || "user";
  const email = lower(legacy.email);
  if (passwordRoles.has(role) && email && !validEmail(email)) {
    return { ok: false, key: item.key || "", id: legacy.id || "", error: "invalid_email" };
  }
  const row = {
    role,
    name: clean(legacy.name) || email || clean(legacy.workerNo) || "Legacy user",
    email: email || null,
    phone: clean(legacy.phone) || null,
    worker_no: workerNoRoles.has(role) ? (clean(legacy.workerNo) || null) : null,
    department: clean(legacy.dept || legacy.department) || null,
    departments: Array.isArray(legacy.depts) ? cleanArray(legacy.depts) : (legacy.dept ? [clean(legacy.dept)] : []),
    manager_zones: cleanArray(legacy.mgrZones),
    tech_scope: techScopes.has(clean(legacy.techScope)) ? clean(legacy.techScope) : null,
    tech_cats: cleanArray(legacy.techCats),
    supplier: clean(legacy.supplier) || null,
    active: legacy.active !== false && legacy.status !== "archived",
    permissions: cleanObject(legacy.perms || legacy.permissions),
    login_metadata: {
      source: "legacy-user-backfill",
      legacy_user_id: clean(legacy.id),
      legacy_key: clean(item.key)
    },
    must_change_password: false,
    position: clean(legacy.position || legacy.jobTitle) || null,
    shift: clean(legacy.shift) || null,
    shift_start: clean(legacy.shiftStart) || null,
    shift_end: clean(legacy.shiftEnd) || null,
    late_tolerance: numberOrNull(legacy.lateTolerance),
    early_tolerance: numberOrNull(legacy.earlyTolerance),
    cleaning_access: legacy.cleaningAccess === undefined ? false : legacy.cleaningAccess,
    notification_prefs: cleanObject(legacy.notificationPrefs || legacy.notificationPreferences || legacy.notifyPrefs),
    employment_type: clean(legacy.employmentType) || null,
    contractor_name: clean(legacy.contractorName) || null,
    reports_to: clean(legacy.reportsTo) || null,
    status: clean(legacy.status) || null,
    exit_at: timestampOrNull(legacy.exitAt),
    ppe_reset_at: timestampOrNull(legacy.ppeResetAt),
    pin_hash: null,
    pin_updated_at: null,
    login_state: legacy.active === false || legacy.status === "archived" ? "disabled" : "pending_setup"
  };
  return { ok: true, key: item.key || "", id: legacy.id || "", row };
}

export function proposeLegacyUserBackfillRows({ legacyRows = [], appUsers = [] } = {}) {
  const report = reconcileLegacyUsers({ legacyRows, appUsers });
  const proposed = [];
  const skipped = [];
  for (const item of report.legacyOnly) {
    const parsed = parseLegacyUserRecord(legacyRows.find((row) => clean(row.record_key || row.key) === item.key) || {});
    const proposal = appUserBackfillRowFromLegacyUser({ key: item.key, user: parsed?.user || item });
    if (proposal.ok) proposed.push(proposal);
    else skipped.push(proposal);
  }
  return {
    ...report,
    proposedBackfill: proposed,
    skippedBackfill: skipped,
    counts: {
      ...report.counts,
      proposedBackfill: proposed.length,
      skippedBackfill: skipped.length
    }
  };
}
