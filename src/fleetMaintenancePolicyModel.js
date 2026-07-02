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

const keySet = (values = []) => new Set(unique(values).map((value) => value.toLowerCase()));
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_REAL_DATE_MS = Date.UTC(2000, 0, 1);

export function normalizeFleetRuleTarget(target = {}) {
  return {
    allFleet: !!target.allFleet,
    vehicleTypeNames: unique(target.vehicleTypeNames || target.types || target.typeNames),
    modelCodes: unique(target.modelCodes || target.models),
    fleetIds: unique(target.fleetIds || target.unitIds)
  };
}

export function normalizeFleetUnitRef(unit = {}, catalog = {}) {
  const modelCode = trim(unit.modelCode || unit.model || unit.type || unit.typeCode);
  const vehicleTypeName = trim(
    unit.vehicleTypeName ||
    unit.typeName ||
    unit.vehicleKind ||
    catalog.modelType?.[modelCode] ||
    unit.category
  );

  return {
    id: trim(unit.id),
    code: trim(unit.code || unit.license || unit.vehicleNumber),
    vehicleTypeName,
    modelCode
  };
}

export function fleetRuleTargetMatchesUnit(target = {}, unitRef = {}) {
  const normalized = normalizeFleetRuleTarget(target);
  if (normalized.allFleet) return true;

  const fleetIds = keySet(normalized.fleetIds);
  const typeNames = keySet(normalized.vehicleTypeNames);
  const modelCodes = keySet(normalized.modelCodes);
  const hasTarget = fleetIds.size || typeNames.size || modelCodes.size;
  if (!hasTarget) return false;

  const unitId = trim(unitRef.id).toLowerCase();
  const unitType = trim(unitRef.vehicleTypeName).toLowerCase();
  const unitModel = trim(unitRef.modelCode).toLowerCase();

  return (unitId && fleetIds.has(unitId)) ||
    (unitType && typeNames.has(unitType)) ||
    (unitModel && modelCodes.has(unitModel));
}

export function normalizeIntervalMonths(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 120) return null;
  return rounded;
}

export function normalizeMaintenanceChecklistItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const label = trim(typeof item === "string" ? item : item?.label || item?.name);
      if (!label) return null;
      const key = label.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const id = trim(typeof item === "string" ? "" : item?.id) ||
        `pm-check-${index}-${label.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/gi, "-").replace(/^-+|-+$/g, "")}`;
      return { id, label };
    })
    .filter(Boolean);
}

export function normalizeMaintenanceRule(rule = {}) {
  const name = trim(rule.name || rule.title);
  const intervalMonths = normalizeIntervalMonths(rule.intervalMonths ?? rule.months);
  if (!name || !intervalMonths) return null;

  const id = trim(rule.id) || `rule:${name.toLowerCase().replace(/\s+/g, "-")}:${intervalMonths}`;
  return {
    id,
    name,
    intervalMonths,
    weight: rule.weight === 2 ? 2 : 1,
    active: rule.active !== false,
    target: normalizeFleetRuleTarget(rule.target || rule),
    maintenanceChecklistItems: normalizeMaintenanceChecklistItems(rule.maintenanceChecklistItems)
  };
}

export function normalizeMaintenanceRules(rules = []) {
  return (Array.isArray(rules) ? rules : [])
    .map(normalizeMaintenanceRule)
    .filter(Boolean);
}

export function maintenanceRulesForUnit(rules = [], unitRef = {}) {
  return normalizeMaintenanceRules(rules)
    .filter((rule) => rule.active && fleetRuleTargetMatchesUnit(rule.target, unitRef));
}

export function maintenanceRuleForTask(task = {}, rules = []) {
  const ruleId = trim(task.maintenanceRuleId || task.ruleId);
  if (!ruleId) return null;
  return normalizeMaintenanceRules(rules).find((rule) => rule.id === ruleId) || null;
}

export function maintenanceIntervalMonthsForTask(task = {}, rules = [], fallbackMonths = 1) {
  const storedInterval = normalizeIntervalMonths(task.intervalMonths);
  if (storedInterval) return storedInterval;

  const rule = maintenanceRuleForTask(task, rules);
  if (rule?.intervalMonths) return rule.intervalMonths;

  return normalizeIntervalMonths(fallbackMonths) || 1;
}

export function maintenanceTitleForTask(task = {}, rules = [], fallback = "טיפול תקופתי") {
  const storedTitle = trim(task.title || task.maintenanceRuleName);
  if (storedTitle) return storedTitle;

  const rule = maintenanceRuleForTask(task, rules);
  return rule?.name || fallback;
}

export function buildMaintenanceAssignments(rules = [], fleetRefs = []) {
  return (Array.isArray(fleetRefs) ? fleetRefs : [])
    .filter((unit) => unit?.id)
    .map((unit) => ({
      unit,
      rules: maintenanceRulesForUnit(rules, unit)
    }));
}

function scheduleIdForRule(unitId, ruleId) {
  const safe = (value) => trim(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `pm-${safe(unitId) || "unit"}-${safe(ruleId) || "rule"}`;
}

function taskRuleKey(task = {}) {
  const unitId = trim(task.forkliftId || task.equipmentId);
  const ruleId = trim(task.maintenanceRuleId || task.ruleId);
  return unitId && ruleId ? `${unitId}::${ruleId}` : "";
}

export function nextWorkingDay(tsMs) {
  let day = new Date(Number(tsMs) || Date.now());
  day.setHours(0, 0, 0, 0);
  while (day.getDay() === 5 || day.getDay() === 6) {
    day = new Date(day.getTime() + DAY_MS);
  }
  return day.getTime();
}

export function distributeNewTasks(assignments = [], { startAt, dailyCapacity = 4 } = {}) {
  const original = Array.isArray(assignments) ? assignments : [];
  const capacity = Math.max(1, Math.floor(Number(dailyCapacity) || 4));
  const rawStart = Number(startAt) || Date.now();
  const firstDay = rawStart >= MIN_REAL_DATE_MS ? nextWorkingDay(rawStart) : rawStart;
  const nextDay = (day) => rawStart >= MIN_REAL_DATE_MS ? nextWorkingDay(day + DAY_MS) : day + DAY_MS;
  const sorted = original
    .map((assignment, index) => ({ assignment, index, weight: assignment?.weight === 2 ? 2 : 1 }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const days = [];
  const addDay = () => {
    const date = days.length ? nextDay(days[days.length - 1].date) : firstDay;
    const day = { date, remaining: capacity, hasHeavy: false };
    days.push(day);
    return day;
  };

  sorted.forEach(({ assignment, weight }) => {
    let target = null;
    if (weight === 2) {
      target = days.find((day) => !day.hasHeavy && day.remaining >= weight);
    } else {
      target = days.find((day) => day.remaining >= weight);
    }
    if (!target) target = addDay();
    if (weight === 2) target.hasHeavy = true;
    if (assignment?.task) assignment.task.nextDue = target.date;
    target.remaining = Math.max(0, target.remaining - Math.min(weight, capacity));
  });

  return original;
}

export function buildMaintenanceScheduleFromRules({ rules = [], fleetRefs = [], existingTasks = [], startAt, now, dailyCapacity = 4, idFactory } = {}) {
  const cleanRules = normalizeMaintenanceRules(rules);
  const ruleWeights = new Map(cleanRules.map((rule) => [rule.id, rule.weight === 2 ? 2 : 1]));
  const units = (Array.isArray(fleetRefs) ? fleetRefs : [])
    .map((unit) => normalizeFleetUnitRef(unit))
    .filter((unit) => unit.id);
  const byRuleKey = new Map();
  (Array.isArray(existingTasks) ? existingTasks : []).forEach((task) => {
    const key = taskRuleKey(task);
    if (key && !byRuleKey.has(key)) byRuleKey.set(key, task);
  });

  const rawFirstDue = Number(startAt) || Date.now();
  const firstDue = rawFirstDue >= MIN_REAL_DATE_MS ? nextWorkingDay(rawFirstDue) : rawFirstDue;
  const nowMs = Number(now) || Date.now();
  const createdAt = nowMs;
  const preserved = [];
  const toDistribute = [];
  let created = 0;
  let updated = 0;

  units.forEach((unit) => {
    maintenanceRulesForUnit(cleanRules, unit).forEach((rule) => {
      const key = `${unit.id}::${rule.id}`;
      const existing = byRuleKey.get(key);
      const base = existing || {};
      const id = base.id || (typeof idFactory === "function" ? idFactory(unit, rule) : scheduleIdForRule(unit.id, rule.id));
      const task = {
        ...base,
        id,
        forkliftId: unit.id,
        frequency: "custom_months",
        title: rule.name,
        maintenanceRuleId: rule.id,
        maintenanceRuleName: rule.name,
        intervalMonths: rule.intervalMonths,
        maintenanceRuleWeight: rule.weight === 2 ? 2 : 1,
        maintenanceChecklistItems: rule.maintenanceChecklistItems || [],
        nextDue: Number(base.nextDue) || firstDue,
        active: base.active !== false,
        createdAt: base.createdAt || createdAt,
        lastDone: base.lastDone || null,
        history: Array.isArray(base.history) ? base.history : []
      };
      if (existing && (Number(base.nextDue) < MIN_REAL_DATE_MS || Number(base.nextDue) > nowMs)) preserved.push(task);
      else toDistribute.push(task);
      if (existing) updated += 1;
      else created += 1;
    });
  });

  distributeNewTasks(
    toDistribute.map((task) => ({ task, weight: ruleWeights.get(task.maintenanceRuleId) || 1 })),
    { startAt: firstDue, dailyCapacity }
  );
  const tasks = [...preserved, ...toDistribute];

  return { tasks, created, updated, total: tasks.length };
}

export function normalizeChecklistTemplate(template = {}) {
  const name = trim(template.name || template.title);
  const items = unique(template.items || String(template.itemsText || "").split(/\n+/));
  if (!name || !items.length) return null;

  const id = trim(template.id) || `checklist:${name.toLowerCase().replace(/\s+/g, "-")}`;
  return {
    id,
    name,
    active: template.active !== false,
    items,
    target: normalizeFleetRuleTarget(template.target || template)
  };
}

export function checklistTemplateMatchesUnit(template = {}, unitRef = {}) {
  const normalized = normalizeChecklistTemplate(template);
  if (!normalized || !normalized.active) return false;
  return fleetRuleTargetMatchesUnit(normalized.target, unitRef);
}

export function addMonthsClamped(dateInput, months) {
  const interval = normalizeIntervalMonths(months);
  if (!interval) return null;
  const base = new Date(dateInput);
  if (Number.isNaN(base.getTime())) return null;

  const day = base.getDate();
  const next = new Date(base);
  next.setDate(1);
  next.setMonth(next.getMonth() + interval);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next.getTime();
}

export function nextMaintenanceDueFrom(lastDoneAt, intervalMonths, { adjustToWorkday } = {}) {
  const next = addMonthsClamped(lastDoneAt, intervalMonths);
  if (!next) return null;
  return typeof adjustToWorkday === "function" ? adjustToWorkday(next) : next;
}
