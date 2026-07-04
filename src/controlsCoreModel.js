const cleanString = (value) => String(value == null ? "" : value).trim();

const uniqueStrings = (value = []) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(Boolean))];
};

const compactObject = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const objectOrEmpty = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const arrayFrom = (value) => Array.isArray(value) ? value : [];

export const CONTROL_DOMAINS = ["safety", "quality", "operations", "fleet", "cleaning", "executive_walk", "maintenance", "general"];
export const CONTROL_ASSIGNMENT_STATUSES = ["planned", "rescheduled", "in_progress", "completed", "cancelled", "missed"];
export const CONTROL_RUN_STATUSES = ["draft", "in_progress", "completed", "cancelled"];
export const CONTROL_FINDING_SEVERITIES = ["info", "low", "medium", "high", "critical"];
export const CONTROL_FINDING_STATUSES = ["open", "triage", "routed", "in_progress", "closed", "dismissed"];
export const CONTROL_ACTION_ROUTE_TYPES = ["report_only", "task", "ticket", "notify", "follow_up", "training", "capa"];

const normalizeDomain = (domain) => {
  const value = cleanString(domain || "general") || "general";
  return CONTROL_DOMAINS.includes(value) ? value : "general";
};

const normalizeStatus = (value, allowed, fallback) => {
  const status = cleanString(value);
  return allowed.includes(status) ? status : fallback;
};

const normalizeSeverity = (severity) => {
  const value = cleanString(severity || "medium") || "medium";
  return CONTROL_FINDING_SEVERITIES.includes(value) ? value : "medium";
};

const normalizeTarget = (target = {}) => {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    const id = cleanString(target);
    return compactObject({ kind: "general", id });
  }

  return compactObject({
    kind: cleanString(target.kind || target.type || target.targetType) || "general",
    id: cleanString(target.id || target.targetId || target.locationId || target.fleetId || target.value) || undefined,
    locationId: cleanString(target.locationId) || undefined,
    label: cleanString(target.label || target.name || target.title) || undefined,
    sourceModule: cleanString(target.sourceModule || target.module) || undefined
  });
};

const normalizeChecklistItems = (items = []) => arrayFrom(items)
  .map((item, index) => {
    if (typeof item === "string") {
      const label = cleanString(item);
      return label ? { id: `item-${index + 1}`, label, photoPolicy: "optional_on_problem" } : null;
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const label = cleanString(item.label || item.name || item.title);
    const id = cleanString(item.id || item.itemId || label || `item-${index + 1}`);
    if (!label && !id) return null;

    return compactObject({
      ...item,
      id,
      label: label || id,
      category: cleanString(item.category) || undefined,
      photoPolicy: cleanString(item.photoPolicy || (item.photoRequired ? "required_on_problem" : "optional_on_problem")) || "optional_on_problem",
      requiresFollowUp: item.requiresFollowUp === true || undefined
    });
  })
  .filter(Boolean);

export const normalizeFindingVisibility = (visibility = {}) => {
  const source = objectOrEmpty(visibility);
  const scope = cleanString(source.scope || source.level || (source.sensitive ? "restricted" : "default")) || "default";

  return compactObject({
    scope: ["default", "restricted", "private", "management", "public"].includes(scope) ? scope : "default",
    userIds: uniqueStrings(source.userIds || source.users),
    groupIds: uniqueStrings(source.groupIds || source.groups),
    departmentIds: uniqueStrings(source.departmentIds || source.departments),
    roleIds: uniqueStrings(source.roleIds || source.roles),
    redactWorkerIdentity: source.redactWorkerIdentity === true || undefined,
    reason: cleanString(source.reason) || undefined
  });
};

export const normalizeActionRoute = (route = {}) => {
  const source = objectOrEmpty(route);
  const type = cleanString(source.type || source.actionType || "report_only") || "report_only";

  return compactObject({
    type: CONTROL_ACTION_ROUTE_TYPES.includes(type) ? type : "report_only",
    status: cleanString(source.status || "pending") || "pending",
    taskId: cleanString(source.taskId || source.mtaskId) || undefined,
    ticketId: cleanString(source.ticketId || source.callId) || undefined,
    followUpId: cleanString(source.followUpId) || undefined,
    notifyIds: uniqueStrings(source.notifyIds || source.userIds),
    groupIds: uniqueStrings(source.groupIds),
    decidedById: cleanString(source.decidedById || source.userId) || undefined,
    decidedAt: source.decidedAt || null,
    note: cleanString(source.note || source.notes) || undefined
  });
};

export const normalizeControlProgram = (program = {}) => {
  const name = cleanString(program.name || program.title);
  const id = cleanString(program.id || program.programId || name);
  const domain = normalizeDomain(program.domain);
  const schedulePolicy = {
    ...objectOrEmpty(program.schedulePolicy || program.schedule),
    preferredWeekdays: uniqueStrings(program.schedulePolicy?.preferredWeekdays || program.schedule?.preferredWeekdays),
    skipWeekends: program.schedulePolicy?.skipWeekends !== false && program.schedule?.skipWeekends !== false,
    nonWorkingDayCalendarId: cleanString(program.schedulePolicy?.nonWorkingDayCalendarId || program.schedule?.nonWorkingDayCalendarId) || undefined,
    antiDuplicateWindowDays: Number(program.schedulePolicy?.antiDuplicateWindowDays ?? program.schedule?.antiDuplicateWindowDays ?? program.antiDuplicateWindowDays ?? 0) || 0,
    coverageThreshold: objectOrEmpty(program.schedulePolicy?.coverageThreshold || program.schedule?.coverageThreshold || program.coverageThreshold),
    maxDelayDays: Number(program.schedulePolicy?.maxDelayDays ?? program.schedule?.maxDelayDays ?? program.maxDelayDays ?? 0) || 0
  };

  return compactObject({
    id,
    name,
    domain,
    process: cleanString(program.process) || undefined,
    active: program.active !== false,
    targetType: cleanString(program.targetType || program.targetKind) || "location",
    targetRules: objectOrEmpty(program.targetRules),
    targetIds: uniqueStrings(program.targetIds || program.locationIds || program.fleetIds),
    checklistItems: normalizeChecklistItems(program.checklistItems || program.checklist),
    schedulePolicy,
    samplingPolicy: objectOrEmpty(program.samplingPolicy),
    responsiblePolicy: objectOrEmpty(program.responsiblePolicy),
    responsibleIds: uniqueStrings(program.responsibleIds || program.ownerIds),
    participantIds: uniqueStrings(program.participantIds),
    notifyIds: uniqueStrings(program.notifyIds),
    groupIds: uniqueStrings(program.groupIds),
    visibility: normalizeFindingVisibility(program.visibility || program.visibilityPolicy),
    actionPolicy: objectOrEmpty(program.actionPolicy),
    photoPolicy: objectOrEmpty(program.photoPolicy)
  });
};

export const normalizeControlAssignment = (assignment = {}) => {
  const target = normalizeTarget(assignment.target || assignment.locationId || assignment.targetId);

  return compactObject({
    id: cleanString(assignment.id || assignment.assignmentId) || undefined,
    programId: cleanString(assignment.programId) || undefined,
    assignedToIds: uniqueStrings(assignment.assignedToIds || assignment.assigneeIds || assignment.responsibleIds),
    participantIds: uniqueStrings(assignment.participantIds),
    groupIds: uniqueStrings(assignment.groupIds),
    target,
    scheduledAt: assignment.scheduledAt || null,
    dueAt: assignment.dueAt || assignment.scheduledAt || null,
    status: normalizeStatus(assignment.status, CONTROL_ASSIGNMENT_STATUSES, "planned"),
    rescheduleHistory: arrayFrom(assignment.rescheduleHistory),
    generatedBy: cleanString(assignment.generatedBy || assignment.source) || "manual",
    createdAt: assignment.createdAt || null,
    sourceProgramId: cleanString(assignment.sourceProgramId || assignment.programId) || undefined
  });
};

export const normalizeControlRun = (run = {}) => compactObject({
  id: cleanString(run.id || run.runId) || undefined,
  programId: cleanString(run.programId) || undefined,
  assignmentId: cleanString(run.assignmentId) || undefined,
  performedById: cleanString(run.performedById || run.userId) || undefined,
  participantIds: uniqueStrings(run.participantIds),
  target: normalizeTarget(run.target || run.locationId || run.targetId),
  startedAt: run.startedAt || null,
  finishedAt: run.finishedAt || run.completedAt || null,
  answers: arrayFrom(run.answers),
  findingIds: uniqueStrings(run.findingIds),
  overallSignature: objectOrEmpty(run.overallSignature || run.signature),
  notes: cleanString(run.notes) || undefined,
  status: normalizeStatus(run.status, CONTROL_RUN_STATUSES, "draft")
});

export const normalizeControlFinding = (finding = {}) => {
  const domain = normalizeDomain(finding.domain);

  return compactObject({
    id: cleanString(finding.id || finding.findingId) || undefined,
    runId: cleanString(finding.runId) || undefined,
    programId: cleanString(finding.programId) || undefined,
    assignmentId: cleanString(finding.assignmentId) || undefined,
    domain,
    process: cleanString(finding.process) || undefined,
    locationId: cleanString(finding.locationId) || undefined,
    target: normalizeTarget(finding.target || finding.locationId || finding.targetId),
    subject: objectOrEmpty(finding.subject),
    checklistItemId: cleanString(finding.checklistItemId) || undefined,
    title: cleanString(finding.title || finding.subjectText || finding.description) || undefined,
    description: cleanString(finding.description) || undefined,
    severity: normalizeSeverity(finding.severity),
    impact: cleanString(finding.impact) || undefined,
    repeatSignal: objectOrEmpty(finding.repeatSignal),
    photos: arrayFrom(finding.photos),
    visibility: normalizeFindingVisibility(finding.visibility),
    route: normalizeActionRoute(finding.route || finding.actionRoute),
    createdById: cleanString(finding.createdById || finding.userId) || undefined,
    createdAt: finding.createdAt || null,
    status: normalizeStatus(finding.status, CONTROL_FINDING_STATUSES, "open")
  });
};

export const controlSignalEnvelope = (record = {}) => {
  const sourceId = cleanString(record.sourceId || record.id || record.findingId || record.assignmentId || record.runId);
  return {
    severity: normalizeSeverity(record.severity || record.priority || (record.status === "missed" ? "high" : "medium")),
    status: cleanString(record.status) || "open",
    assignedTo: uniqueStrings(record.assignedTo || record.assignedToIds || record.responsibleIds || record.participantIds),
    dueAt: record.dueAt || record.scheduledAt || null,
    sourceModule: "controls",
    sourceId: sourceId || null
  };
};
