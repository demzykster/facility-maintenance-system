const HEADER_ALIASES = {
  supplier: ["ספק"],
  chassis: ["מס' רכב", "מס׳ רכב", "מס רכב", ":מס' רכב", ":מס׳ רכב"],
  model: ["דגם"],
  regulated: ["ברגולציה"],
  tasrirDate: ["תוקף תסקיר"],
  licenseDate: ["רישיון"],
  vehicleKind: ["סוג כלי"],
  classification: ["סיווג כלי"],
  leaseStart: ["תאריך תחילת עסקה"],
  leaseEnd: ["תאריך סוף עסקה"],
  leaseCost: ["חודשי סה\"כ", "סה\"כ חודשי", "חודשי סהכ"]
};

const IGNORED_HEADERS = new Set([
  "ימי לבדיקה תסקיר",
  "טווח בדיקה תסקיר",
  "סטאטוס",
  "סטטוס",
  "ימי לבדיקה רישוי",
  "טווח בדיקה רישיון",
  "=TODAY()"
]);

const cleanHeader = (value) => String(value ?? "")
  .replace(/\u00a0/g, " ")
  .replace(/^\.+|\.+$/g, "")
  .replace(/^:+|:+$/g, "")
  .replace(/\s+/g, " ")
  .trim();

const cleanText = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const normalizeDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = cleanText(value);
  if (!text || /^אין\s/.test(text)) return "";
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (local) {
    const year = Number(local[3]) < 100 ? 2000 + Number(local[3]) : Number(local[3]);
    return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }
  return "";
};

const normalizeMoney = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = cleanText(value);
  if (!text || text === "בבעלות") return 0;
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export function detectFleetLicenseColumns(headerRow = []) {
  const headers = headerRow.map(cleanHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = headers.findIndex((header) => aliases.some((alias) => cleanHeader(alias) === header));
    if (found >= 0) map[field] = found;
  }
  return { headers, map, ignored: headers.filter((header) => IGNORED_HEADERS.has(header)) };
}

const readCell = (row, map, field) => map[field] == null ? "" : row[map[field]];

const existingConflict = (unit, existingFleet = []) => {
  const code = cleanText(unit.code).toLowerCase();
  const chassis = cleanText(unit.chassis).toLowerCase();
  return (existingFleet || []).find((item) => {
    const itemCode = cleanText(item?.code).toLowerCase();
    const itemChassis = cleanText(item?.chassis).toLowerCase();
    return (code && itemCode === code) || (chassis && itemChassis === chassis);
  }) || null;
};

export function planFleetLicenseCatalogAdditions(rows = [], config = {}) {
  const existingModels = new Set();
  (config.forkliftTypes || []).forEach((model) => { const m = cleanText(model); if (m) existingModels.add(m); });
  (config.vehicleTypes || []).forEach((type) => (type.models || []).forEach((model) => { const m = cleanText(model); if (m) existingModels.add(m); }));
  const byType = new Map();

  (rows || []).filter((row) => row?.action === "new").forEach((row) => {
    const unit = row.unit || {};
    const model = cleanText(unit.model || unit.type);
    if (!model || existingModels.has(model)) return;
    const name = cleanText(unit.vehicleKind || unit.notes || model) || model;
    if (!byType.has(name)) byType.set(name, { name, models: [], docs: { tasrir: false, license: false, lease: false } });
    const entry = byType.get(name);
    if (!entry.models.includes(model)) entry.models.push(model);
    entry.docs.tasrir = entry.docs.tasrir || !!unit.docs?.tasrir;
    entry.docs.license = entry.docs.license || !!unit.docs?.license;
    entry.docs.lease = entry.docs.lease || !!unit.docs?.lease;
  });

  return [...byType.values()].sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export function parseFleetLicenseSheet(aoa = [], options = {}) {
  const headerIndex = aoa.findIndex((row) => (row || []).some((cell) => cleanHeader(cell) === "ספק") && (row || []).some((cell) => cleanHeader(cell).includes("רכב")));
  if (headerIndex < 0) {
    return { ok: false, error: "fleet_license_header_not_found", columnMap: {}, rows: [], summary: { total: 0, ready: 0, conflicts: 0, invalid: 0 } };
  }

  const { headers, map, ignored } = detectFleetLicenseColumns(aoa[headerIndex]);
  const required = ["supplier", "chassis", "model", "tasrirDate", "licenseDate", "vehicleKind", "classification"];
  const missing = required.filter((field) => map[field] == null);
  if (missing.length) {
    return { ok: false, error: "fleet_license_required_columns_missing", missing, columnMap: map, rows: [], summary: { total: 0, ready: 0, conflicts: 0, invalid: 0 } };
  }

  const rows = aoa.slice(headerIndex + 1)
    .map((row, offset) => {
      const sourceRow = headerIndex + offset + 2;
      const supplier = cleanText(readCell(row, map, "supplier"));
      const chassis = cleanText(readCell(row, map, "chassis"));
      const model = cleanText(readCell(row, map, "model"));
      const vehicleKind = cleanText(readCell(row, map, "vehicleKind"));
      const classification = cleanText(readCell(row, map, "classification"));
      const hasSourceData = [supplier, chassis, model, vehicleKind, classification].some(Boolean)
        || normalizeDate(readCell(row, map, "tasrirDate"))
        || normalizeDate(readCell(row, map, "licenseDate"))
        || normalizeDate(readCell(row, map, "leaseEnd"));
      if (!hasSourceData) return null;
      const tasrir = normalizeDate(readCell(row, map, "tasrirDate"));
      const license = normalizeDate(readCell(row, map, "licenseDate"));
      const leaseEnd = normalizeDate(readCell(row, map, "leaseEnd"));
      const leaseStart = normalizeDate(readCell(row, map, "leaseStart"));
      const leaseCostRaw = readCell(row, map, "leaseCost");
      const leaseCost = normalizeMoney(leaseCostRaw);
      const owned = cleanText(leaseCostRaw) === "בבעלות";
      const docs = {};
      if (tasrir) docs.tasrir = { date: tasrir, link: "" };
      if (license) docs.license = { date: license, link: "" };
      if (leaseEnd) docs.lease = { date: leaseEnd, link: "" };
      const unit = {
        code: chassis,
        chassis,
        supplier,
        type: model,
        model,
        license: "",
        leaseCost,
        depts: [],
        dept: "",
        notes: vehicleKind,
        docs,
        importSource: "fleet-license-sheet",
        vehicleKind,
        classification,
        regulated: cleanText(readCell(row, map, "regulated")) === "כן",
        leaseStart,
        leaseEnd,
        leaseOwnership: owned ? "owned" : (leaseEnd || leaseStart || leaseCost ? "leased" : "")
      };
      const warnings = [];
      if (chassis) warnings.push("code_uses_chassis_until_manual_code_review");
      if (!Object.keys(docs).length) warnings.push("no_managed_document_dates");
      if (owned) warnings.push("owned_unit_no_lease_cost");
      const invalid = [];
      if (!chassis) invalid.push("missing_chassis");
      if (!supplier) invalid.push("missing_supplier");
      if (!model) invalid.push("missing_model");
      const conflict = invalid.length ? null : existingConflict(unit, options.existingFleet);
      return {
        sourceRow,
        action: invalid.length ? "invalid" : conflict ? "conflict" : "new",
        invalid,
        conflictId: conflict?.id || "",
        warnings,
        unit
      };
    })
    .filter(Boolean);

  const summary = {
    total: rows.length,
    ready: rows.filter((row) => row.action === "new").length,
    conflicts: rows.filter((row) => row.action === "conflict").length,
    invalid: rows.filter((row) => row.action === "invalid").length
  };
  return { ok: true, sheet: "רישיונות", headerRow: headerIndex + 1, headers, columnMap: map, ignoredHeaders: ignored, rows, summary };
}

export function parseFleetLicenseWorkbook(sheets = [], options = {}) {
  const sheet = (sheets || []).find((item) => item?.sheet === "רישיונות");
  if (!sheet) {
    return { ok: false, error: "fleet_license_sheet_not_found", sheet: "רישיונות", columnMap: {}, rows: [], summary: { total: 0, ready: 0, conflicts: 0, invalid: 0 } };
  }
  return parseFleetLicenseSheet(sheet.data || [], options);
}
