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

export function normalizeMaintenanceRule(rule = {}) {
  const name = trim(rule.name || rule.title);
  const intervalMonths = normalizeIntervalMonths(rule.intervalMonths ?? rule.months);
  if (!name || !intervalMonths) return null;

  const id = trim(rule.id) || `rule:${name.toLowerCase().replace(/\s+/g, "-")}:${intervalMonths}`;
  return {
    id,
    name,
    intervalMonths,
    active: rule.active !== false,
    checklistTemplateId: trim(rule.checklistTemplateId || rule.templateId),
    target: normalizeFleetRuleTarget(rule.target || rule)
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
