export const AUDIT_ENTITY_TYPES = Object.freeze({
  ticket: "ticket",
  user: "user",
  permission: "permission",
  settings: "settings",
  file: "file",
  fleet: "fleet",
  cleaning: "cleaning",
  ppe: "ppe",
  task: "task",
  meeting: "meeting",
  memory: "memory",
  system: "system"
});

export const AUDIT_ACTIONS = Object.freeze({
  create: "create",
  update: "update",
  delete: "delete",
  restore: "restore",
  statusChange: "status_change",
  permissionChange: "permission_change",
  upload: "upload",
  download: "download",
  login: "login",
  logout: "logout",
  bootstrap: "bootstrap",
  clientError: "client_error",
  aiAssist: "ai_assist",
  propose: "propose",
  use: "use",
  deactivate: "deactivate"
});

const ENTITY_TYPES = new Set(Object.values(AUDIT_ENTITY_TYPES));
const ACTIONS = new Set(Object.values(AUDIT_ACTIONS));

const cleanString = (value) => String(value || "").trim();
const cleanObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const auditEventId = ({ at, actorId, entityType, entityId, action }) => (
  [at || Date.now(), actorId || "system", entityType, entityId || "global", action].map((part) => cleanString(part).replace(/[:\s]+/g, "-")).join(":")
);

export function normalizeAuditEvent(input = {}) {
  const entityType = cleanString(input.entityType);
  const action = cleanString(input.action);
  if (!ENTITY_TYPES.has(entityType)) throw new Error("audit_entity_type_invalid");
  if (!ACTIONS.has(action)) throw new Error("audit_action_invalid");

  const at = Number(input.at || Date.now());
  const actorId = cleanString(input.actorId);
  const entityId = cleanString(input.entityId);
  return {
    id: cleanString(input.id) || auditEventId({ at, actorId, entityType, entityId, action }),
    at,
    actorId,
    actorName: cleanString(input.actorName),
    actorRole: cleanString(input.actorRole),
    entityType,
    entityId,
    action,
    summary: cleanString(input.summary),
    before: cleanObject(input.before),
    after: cleanObject(input.after),
    metadata: cleanObject(input.metadata)
  };
}

export function ticketStatusAuditEvent(ticket = {}, previousStatus = "", nextStatus = "", actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at || ticket.updatedAt,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.ticket,
    entityId: ticket.id,
    action: AUDIT_ACTIONS.statusChange,
    summary: `Ticket status changed from ${previousStatus || "unknown"} to ${nextStatus || "unknown"}`,
    before: { status: previousStatus || "" },
    after: { status: nextStatus || "" },
    metadata: { track: ticket.track || "", num: ticket.num || null }
  });
}

export function permissionAuditEvent(user = {}, beforePerms = {}, afterPerms = {}, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.permission,
    entityId: user.id,
    action: AUDIT_ACTIONS.permissionChange,
    summary: `Permissions changed for ${user.name || user.id || "user"}`,
    before: beforePerms,
    after: afterPerms,
    metadata: { targetName: user.name || "", targetRole: user.role || "" }
  });
}

export function settingsAuditEvent(settingKey = "", beforeValue = null, afterValue = null, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.settings,
    entityId: cleanString(settingKey),
    action: AUDIT_ACTIONS.update,
    summary: `Setting updated: ${cleanString(settingKey)}`,
    before: { value: beforeValue },
    after: { value: afterValue },
    metadata: options.metadata
  });
}

export function fileAuditEvent(file = {}, action = AUDIT_ACTIONS.upload, actor = {}, options = {}) {
  return normalizeAuditEvent({
    at: options.at || file.createdAt,
    actorId: actor.id || file.createdById,
    actorName: actor.name || file.createdByName,
    actorRole: actor.role || file.createdByRole,
    entityType: AUDIT_ENTITY_TYPES.file,
    entityId: file.id || file.path,
    action,
    summary: `File ${action}: ${file.path || file.id || "unknown"}`,
    before: options.before,
    after: { path: file.path || "", kind: file.kind || "", ownerType: file.ownerType || "", ownerId: file.ownerId || "" },
    metadata: { contentType: file.contentType || "", bucket: file.bucket || "" }
  });
}

const countArray = (value) => Array.isArray(value) ? value.length : 0;

export function aiAssistAuditEvent({
  draft = {},
  context = {},
  provider = "",
  model = "",
  providerStatus = "ok",
  capability = "",
  autonomous = false,
  outcome = "",
  reason = "",
  requestId = "",
  ticketId = "",
  ticketNumber = "",
  resolvedAssetId = "",
  domain = "",
  resolvedLocation = "",
  category = "",
  autonomyConfigured = false,
  autonomyPermissionKey = "",
  autonomyPermissionLevel = "",
  autonomyPermissionRequired = "",
  autonomyPermitted = false,
  autonomyEffectiveAccess = false,
  serverCreateReady = false,
  serverCreateConfigured = false,
  workflow = "general",
  responseLanguage = {},
  assistantLanguage = "",
  actionCount = 0,
  readyActionCount = 0,
  missingFieldCount = 0,
  actionTypes = [],
  missingFields = [],
  draftTelemetry = {},
  memoryGrounding = {}
} = {}, actor = {}, options = {}) {
  const requestedLanguage = responseLanguage && typeof responseLanguage === "object" ? responseLanguage : {};
  const requestedLanguageCode = requestedLanguage.code || draft.language || "";
  const actualLanguageCode = assistantLanguage || "";
  const safeActionTypes = Array.isArray(actionTypes) ? actionTypes.map((value) => cleanString(value)).filter(Boolean).slice(0, 8) : [];
  const safeMissingFields = Array.isArray(missingFields) ? missingFields.map((value) => cleanString(value)).filter(Boolean).slice(0, 12) : [];
  const telemetry = cleanObject(draftTelemetry);
  const grounding = cleanObject(memoryGrounding);
  const usedMemoryIds = Array.isArray(grounding.usedMemoryIds)
    ? grounding.usedMemoryIds.map((value) => cleanString(value)).filter(Boolean).slice(0, 24)
    : [];
  const rejectedMemoryIds = Array.isArray(grounding.rejectedMemoryIds)
    ? grounding.rejectedMemoryIds.map((value) => cleanString(value)).filter(Boolean).slice(0, 24)
    : [];
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.system,
    entityId: "ai-assist",
    action: AUDIT_ACTIONS.aiAssist,
    summary: `AI assist ${providerStatus}: ${draft.module || "unknown"}`,
    after: {
      allowedToWrite: draft.allowedToWrite === true,
      writePolicy: draft.writePolicy || "human_confirmation_required"
    },
    metadata: {
      source: draft.source || "",
      language: draft.language || "",
      requestedLanguage: requestedLanguageCode,
      requestedLanguageSource: requestedLanguage.source || "",
      assistantLanguage: actualLanguageCode,
      languageMismatch: !!requestedLanguageCode && !!actualLanguageCode && requestedLanguageCode !== actualLanguageCode,
      module: draft.module || "",
      severity: draft.severity || "",
      action: draft.action || "",
      actionCount: Number(actionCount) || 0,
      readyActionCount: Number(readyActionCount) || 0,
      missingFieldCount: Number(missingFieldCount) || 0,
      actionTypes: safeActionTypes,
      missingFields: safeMissingFields,
      intakeTelemetry: {
        mergedFromRecentConversation: telemetry.mergedFromRecentConversation === true,
        recentConversationCount: Number(telemetry.recentConversationCount) || 0,
        latestUserMessageChars: Number(telemetry.latestUserMessageChars) || 0,
        draftInputChars: Number(telemetry.draftInputChars) || 0
      },
      provider: provider || "",
      model: model || "",
      providerStatus,
      capability: cleanString(capability),
      autonomous: autonomous === true,
      outcome: cleanString(outcome),
      reason: cleanString(reason),
      requestId: cleanString(requestId),
      ticketId: cleanString(ticketId),
      ticketNumber: cleanString(ticketNumber),
      resolvedAssetId: cleanString(resolvedAssetId),
      domain: cleanString(domain),
      resolvedLocation: cleanString(resolvedLocation),
      category: cleanString(category),
      autonomyConfigured: autonomyConfigured === true,
      autonomyPermissionKey: cleanString(autonomyPermissionKey),
      autonomyPermissionLevel: cleanString(autonomyPermissionLevel),
      autonomyPermissionRequired: cleanString(autonomyPermissionRequired),
      autonomyPermitted: autonomyPermitted === true,
      autonomyEffectiveAccess: autonomyEffectiveAccess === true,
      serverCreateReady: serverCreateReady === true,
      serverCreateConfigured: serverCreateConfigured === true,
      workflow,
      memoryGrounding: {
        mode: cleanString(grounding.mode),
        retrievedCount: Number(grounding.retrievedCount) || 0,
        usedMemoryIds,
        rejectedMemoryIds
      },
      contextProfile: {
        role: context.profile?.role || actor.role || "",
        department: context.profile?.department || "",
        canSeeCompany: context.profile?.canSeeCompany === true,
        canSeeFinancials: context.profile?.canSeeFinancials === true
      },
      contextCounts: {
        tickets: countArray(context.tickets),
        fleet: countArray(context.fleet),
        pm: countArray(context.pm),
        tasks: countArray(context.tasks),
        meetings: countArray(context.meetings),
        metrics: context.metrics && typeof context.metrics === "object" ? Object.keys(context.metrics).length : 0
      }
    }
  });
}

export function aiMemoryAuditEvent({
  fact = {},
  action = AUDIT_ACTIONS.create,
  outcome = "ok",
  reason = "",
  requestId = "",
  usedFactIds = []
} = {}, actor = {}, options = {}) {
  const safeUsedFactIds = Array.isArray(usedFactIds)
    ? usedFactIds.map((value) => cleanString(value)).filter(Boolean).slice(0, 24)
    : [];
  return normalizeAuditEvent({
    at: options.at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.memory,
    entityId: cleanString(fact.id) || "memory",
    action,
    summary: `AI memory ${action}`,
    before: options.before,
    after: {
      scopeType: cleanString(fact.scopeType || fact.scope_type),
      scopeId: cleanString(fact.scopeId || fact.scope_id),
      factType: cleanString(fact.factType || fact.fact_type),
      confidence: cleanString(fact.confidence),
      status: cleanString(fact.status)
    },
    metadata: {
      outcome: cleanString(outcome),
      reason: cleanString(reason),
      requestId: cleanString(requestId),
      sourceType: cleanString(fact.sourceType || fact.source_type),
      sourceId: cleanString(fact.sourceId || fact.source_id),
      sourceLabel: cleanString(fact.sourceLabel || fact.source_label),
      usedFactIds: safeUsedFactIds
    }
  });
}

export function aiConversationAuditEvent({
  conversation = {},
  action = AUDIT_ACTIONS.use,
  outcome = "ok",
  reason = "",
  requestId = "",
  messageCount = 0,
  messageRole = ""
} = {}, actor = {}, options = {}) {
  const at = Number(options.at || Date.now());
  const conversationId = cleanString(conversation.id);
  const safeRequestId = cleanString(requestId);
  const safeMessageRole = cleanString(messageRole);
  return normalizeAuditEvent({
    id: [
      at,
      actor.id || "system",
      "ai-conversation",
      conversationId || "global",
      action,
      safeRequestId || "request",
      safeMessageRole || "conversation",
      cleanString(outcome) || "ok"
    ].map((part) => cleanString(part).replace(/[:\s]+/g, "-")).join(":"),
    at,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType: AUDIT_ENTITY_TYPES.system,
    entityId: "ai-conversation",
    action,
    summary: `AI conversation ${action}`,
    after: {
      conversationId,
      status: cleanString(conversation.status)
    },
    metadata: {
      outcome: cleanString(outcome),
      reason: cleanString(reason),
      requestId: safeRequestId,
      conversationId,
      messageCount: Number(messageCount) || 0,
      messageRole: safeMessageRole
    }
  });
}

export const AUDIT_EVENTS_TABLE_CONTRACT = Object.freeze([
  "id",
  "at",
  "actor_id",
  "actor_name",
  "actor_role",
  "entity_type",
  "entity_id",
  "action",
  "summary",
  "before",
  "after",
  "metadata"
]);
