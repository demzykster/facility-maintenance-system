const DAY_MS = 24 * 60 * 60 * 1000;
export const INSPECTION_MONTH_MS = 30.44 * DAY_MS;

const trim = (value) => String(value ?? "").trim();

const unique = (values = []) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(trim)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const slug = (value) => trim(value)
  .toLowerCase()
  .replace(/[^a-z0-9\u0590-\u05ff]+/gi, "-")
  .replace(/^-+|-+$/g, "") || "program";

export function normalizeInspectionProgram(prog = {}) {
  const name = trim(prog.name || prog.title);
  const intervalMonths = Math.round(Number(prog.intervalMonths ?? prog.months));
  if (!name || !Number.isFinite(intervalMonths) || intervalMonths < 1 || intervalMonths > 120) return null;
  const checklist = (Array.isArray(prog.checklist) ? prog.checklist : [])
    .map((item, index) => {
      const label = trim(typeof item === "string" ? item : item?.label || item?.name);
      if (!label) return null;
      return {
        id: trim(typeof item === "string" ? "" : item?.id) || `ci-${index}`,
        label
      };
    })
    .filter(Boolean);

  return {
    id: trim(prog.id) || `iprg-${slug(name)}-${intervalMonths}`,
    name,
    intervalMonths,
    checklist,
    responsibleIds: unique(prog.responsibleIds),
    notifyIds: unique(prog.notifyIds),
    autoTicket: prog.autoTicket !== false,
    active: prog.active !== false
  };
}

export function inspectionProgramsForType(vehicleType = {}) {
  return (Array.isArray(vehicleType.inspectionPrograms) ? vehicleType.inspectionPrograms : [])
    .map(normalizeInspectionProgram)
    .filter((program) => program && program.active !== false);
}

export function isInspectionDue(program, lastInspAt, now = Date.now()) {
  const normalized = normalizeInspectionProgram(program);
  if (!normalized) return false;
  if (lastInspAt == null) return true;
  return Number(now) - Number(lastInspAt) >= normalized.intervalMonths * INSPECTION_MONTH_MS;
}

export function nextInspectionDue(program, lastInspAt) {
  const normalized = normalizeInspectionProgram(program);
  if (!normalized) return null;
  if (lastInspAt == null) return 0;
  return Number(lastInspAt) + normalized.intervalMonths * INSPECTION_MONTH_MS;
}

export function migrateInspectionProgramsFromTemplates(config = {}, templates = [], defaultInterval = 2) {
  if (config?.vtInspMigV === 1) return config;
  const intervalMonths = Math.max(1, Math.min(120, Math.round(Number(defaultInterval) || 2)));
  const templateById = new Map((Array.isArray(templates) ? templates : []).map((tpl) => [trim(tpl.id), tpl]));
  const vehicleTypes = (Array.isArray(config.vehicleTypes) ? config.vehicleTypes : []).map((vt) => {
    const inspTpl = trim(vt?.inspTpl);
    const existingPrograms = Array.isArray(vt?.inspectionPrograms) ? vt.inspectionPrograms : [];
    if (!inspTpl || existingPrograms.length) return vt;
    const tpl = templateById.get(inspTpl);
    if (!tpl) return vt;
    return {
      ...vt,
      inspectionPrograms: [{
        id: `iprg-migrated-${trim(vt.id) || slug(vt.name || inspTpl)}`,
        name: trim(tpl.name) || "בקרה",
        intervalMonths,
        checklist: (Array.isArray(tpl.items) ? tpl.items : []).map((label, index) => ({ id: `mc-${index}`, label: trim(label) })).filter((item) => item.label),
        responsibleIds: [],
        notifyIds: [],
        autoTicket: true,
        active: true
      }]
    };
  });
  return { ...config, vehicleTypes, vtInspMigV: 1 };
}

function latestInspectionForUnit(insps = [], fleetId) {
  return (Array.isArray(insps) ? insps : [])
    .filter((record) => record?.fleetId === fleetId)
    .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))[0] || null;
}

function unitModel(unit = {}, helpers = {}) {
  if (typeof helpers.unitModelCode === "function") return trim(helpers.unitModelCode(unit));
  return trim(unit.modelCode || unit.model || unit.type || unit.typeCode);
}

function unitType(unit = {}, config = {}, helpers = {}) {
  if (typeof helpers.unitTypeName === "function") return trim(helpers.unitTypeName(unit, config));
  const model = unitModel(unit, helpers);
  return trim(unit.vehicleTypeName || unit.typeName || unit.vehicleKind || config.modelType?.[model] || unit.category);
}

export function buildInspectionDuePairs({ fleet = [], insps = [], config = {}, now = Date.now(), unitModelCode, unitTypeName } = {}) {
  const helpers = { unitModelCode, unitTypeName };
  const inspIndex = {};
  (Array.isArray(insps) ? insps : []).forEach((record) => {
    const key = `${record.fleetId}::${record.programId || `tpl::${record.templateId || ""}`}`;
    if (!inspIndex[key] || (Number(record.at) || 0) > (Number(inspIndex[key].at) || 0)) inspIndex[key] = record;
  });

  const pairs = [];
  (Array.isArray(fleet) ? fleet : []).forEach((unit) => {
    const model = unitModel(unit, helpers);
    const type = unitType(unit, config, helpers);
    const vehicleType = (config.vehicleTypes || []).find((vt) =>
      (Array.isArray(vt.models) && model && vt.models.includes(model)) ||
      (type && vt.name === type)
    );
    const programs = inspectionProgramsForType(vehicleType || {});
    if (!programs.length) {
      const last = latestInspectionForUnit(insps, unit.id);
      const lastAt = last?.at || null;
      if (!lastAt || Number(now) - Number(lastAt) > 30 * DAY_MS) pairs.push({ f: unit, prog: null, lastAt, legacy: true });
      return;
    }
    programs.forEach((prog) => {
      const key = `${unit.id}::${prog.id}`;
      const legacyKey = `${unit.id}::tpl::${vehicleType?.inspTpl || ""}`;
      const lastAt = inspIndex[key]?.at || inspIndex[legacyKey]?.at || null;
      if (isInspectionDue(prog, lastAt, now)) pairs.push({ f: unit, prog, lastAt, legacy: false });
    });
  });
  return pairs;
}
