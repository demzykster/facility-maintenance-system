const SOURCE_FIELDS = [
  "sourceModule",
  "sourceId",
  "sourceRecordId",
  "sourceFindingId",
  "sourceProgramId",
  "sourceRunId",
  "sourceLabel"
];

const cleanString = (value) => {
  const text = String(value == null ? "" : value).trim();
  return text || null;
};

const uniqueStrings = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item)).filter(Boolean))];
};

export const taskActionSourceFields = (task = {}) => {
  const patch = {};
  SOURCE_FIELDS.forEach((field) => {
    const value = cleanString(task[field]);
    if (value) patch[field] = value;
  });
  const sourceRef = task.sourceRef && typeof task.sourceRef === "object" ? task.sourceRef : null;
  if (sourceRef) {
    const normalizedRef = {};
    ["module", "id", "recordId", "findingId", "programId", "runId", "label"].forEach((field) => {
      const value = cleanString(sourceRef[field]);
      if (value) normalizedRef[field] = value;
    });
    if (Object.keys(normalizedRef).length) patch.sourceRef = normalizedRef;
  }
  return patch;
};

export const normalizeTaskActionRecord = (task = {}) => {
  const sourcePatch = taskActionSourceFields(task);
  const sourceRef = sourcePatch.sourceRef || {};
  const sourceModule = sourcePatch.sourceModule || sourceRef.module || null;
  const sourceId = sourcePatch.sourceId || sourceRef.id || sourcePatch.sourceRecordId || sourceRef.recordId || sourcePatch.sourceFindingId || sourceRef.findingId || null;
  const sourceLabel = sourcePatch.sourceLabel || sourceRef.label || null;

  const normalized = {
    ...task,
    responsibleIds: uniqueStrings(task.responsibleIds),
    participantIds: uniqueStrings(task.participantIds),
    linkedMeetingIds: uniqueStrings(task.linkedMeetingIds)
  };

  SOURCE_FIELDS.forEach((field) => {
    delete normalized[field];
  });
  delete normalized.sourceRef;

  Object.assign(normalized, sourcePatch);
  if (sourceModule) normalized.sourceModule = sourceModule;
  if (sourceId) normalized.sourceId = sourceId;
  if (sourceLabel) normalized.sourceLabel = sourceLabel;

  return normalized;
};

export const taskActionSignal = (task = {}) => ({
  severity: task.priority || "medium",
  status: task.status || "todo",
  assignedTo: uniqueStrings(task.responsibleIds),
  dueAt: task.dueAt || null,
  sourceModule: task.sourceModule || task.sourceRef?.module || task.origin || null,
  sourceId: task.sourceId || task.sourceRef?.id || task.sourceFindingId || task.meetingId || null
});
