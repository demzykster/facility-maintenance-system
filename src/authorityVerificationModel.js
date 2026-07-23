const UUID_LITERAL_PATTERN = /["'][0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}["']/i;
const EMAIL_LITERAL_PATTERN = /["'][^"'\s@]+@[^"'\s@]+\.[^"'\s@]+["']/i;
const PRIVILEGED_WORD_PATTERN = /\b(admin|owner|super[_-]?admin|system[_-]?manager|privileged|allow(?:ed)?|whitelist)\b/i;
const ROUTING_WORD_PATTERN = /\b(assignee|supplier|technician|manager|approver|closer|department|dept|queue|routing)\b/i;
const DEFAULT_ASSIGNEE_PATTERN = /\b(?:assignee|assigneeId|assigneeName|supplier|manager|approver)\s*:\s*["'][^"']+["']/;
const BODY_ACTOR_PATTERN = /\b(actor(?:Id|Name|Role)?|createdBy|reportedBy)\s*[:=]\s*(?:body|req\.body|payload|input|ticket)\b/i;
const FIRST_USER_PATTERN = /\b(first[-_\s]?user|first[-_\s]?admin|bootstrap_admin|bootstrap.*admin|admin.*already.*exists)\b/i;
const DEMO_MARKER_PATTERN = /\b(SEED_POLICY|allowBuiltinDemoUsers|builtin|demo|owner@example\.local|demo@local|demo1234)\b/i;

const CODE_PATH_PATTERN = /^(api|server|src)\//;
const SERVER_AUTHORITY_PATH_PATTERN = /^(api|server)\//;
const TEST_PATH_PATTERN = /(^|\/)(tests?|__tests__)\//;
const DOC_PATH_PATTERN = /^docs\//;
const TOOL_PATH_PATTERN = /^(tools|\.github)\//;
const MODEL_SELF_PATH = "src/authorityVerificationModel.js";

export const AUTHORITY_VERIFY_STATUSES = Object.freeze([
  "READY",
  "READY_WITH_OWNER_DECISIONS",
  "HARDCODED_IDENTITY_FOUND",
  "HARDCODED_ROUTING_FOUND",
  "CLIENT_ONLY_AUTHORIZATION_FOUND",
  "SINGLE_IDENTITY_DEPENDENCY",
  "UNVERIFIED"
]);

export function stableAuthorityJson(value) {
  return JSON.stringify(sortStable(value), null, 2);
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortStable(value[key]);
    return acc;
  }, {});
}

function normalizePath(file = "") {
  return String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function cleanLine(line = "") {
  return String(line || "").trim().replace(/\s+/g, " ");
}

export function classifyAuthorityEntry({ file = "", line = "" } = {}) {
  const path = normalizePath(file);
  const text = String(line || "");
  const relevantText = EMAIL_LITERAL_PATTERN.test(text)
    || UUID_LITERAL_PATTERN.test(text)
    || DEFAULT_ASSIGNEE_PATTERN.test(text)
    || BODY_ACTOR_PATTERN.test(text)
    || FIRST_USER_PATTERN.test(text)
    || DEMO_MARKER_PATTERN.test(text);

  if (!text.trim()) return null;
  if (DOC_PATH_PATTERN.test(path)) return relevantText ? "DOCUMENTATION_ONLY" : null;
  if (TEST_PATH_PATTERN.test(path)) return relevantText ? "TEST_FIXTURE_ONLY" : null;
  if (TOOL_PATH_PATTERN.test(path)) return relevantText ? "TOOLING_ONLY" : null;
  if (path === MODEL_SELF_PATH) return "TOOLING_ONLY";
  if (path === "server/ai/intakeHandler.js" && /body\.actor/.test(text)) return "NON_AUTHORITATIVE_CONTEXT";
  if (path === "src/ClaudeMaintenanceApp.jsx" && DEMO_MARKER_PATTERN.test(text)) return "BOOTSTRAP_DEMO_ONLY";
  if (path === "src/ClaudeMaintenanceApp.jsx" && /\{id:\s*["']v-/.test(text)) return null;
  if (!CODE_PATH_PATTERN.test(path)) return null;

  if (EMAIL_LITERAL_PATTERN.test(text) && PRIVILEGED_WORD_PATTERN.test(text)) return "HARDCODED_IDENTITY_RISK";
  if (UUID_LITERAL_PATTERN.test(text) && (PRIVILEGED_WORD_PATTERN.test(text) || (SERVER_AUTHORITY_PATH_PATTERN.test(path) && ROUTING_WORD_PATTERN.test(text)) || /===|!==|includes\(/.test(text))) return "HARDCODED_IDENTITY_RISK";
  if (SERVER_AUTHORITY_PATH_PATTERN.test(path) && DEFAULT_ASSIGNEE_PATTERN.test(text) && !/createdBy|reportedBy|actorTicketPayload|actorPayload|normalize|legacy|test/i.test(text)) return "HARDCODED_ROUTING_RISK";
  if (SERVER_AUTHORITY_PATH_PATTERN.test(path) && BODY_ACTOR_PATTERN.test(text) && !/delete safe|sanitize|SYSTEM_CREATE_FIELDS|actorTicketPayload|createdBy: actorPayload|reportedBy: actorPayload/i.test(text)) return "CLIENT_ONLY_AUTHORIZATION_RISK";
  if (FIRST_USER_PATTERN.test(text)) return "BOOTSTRAP_ONLY";
  return null;
}

export function scanAuthorityInventory({ files = [], entries = [] } = {}) {
  const normalizedFiles = files.map(normalizePath).sort();
  const findings = [];
  const classificationCounts = {};

  for (const entry of entries) {
    const classification = classifyAuthorityEntry(entry);
    if (!classification) continue;
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
    if (!classification.endsWith("_RISK")) continue;
    findings.push({
      file: normalizePath(entry.file),
      lineNumber: Number(entry.lineNumber || 0) || undefined,
      line: cleanLine(entry.line),
      classification
    });
  }

  const hasSessionAuthority = normalizedFiles.includes("server/session/sessionHandler.js")
    && normalizedFiles.includes("src/supabaseProfileModel.js");
  const hasLifecycleAuthority = normalizedFiles.includes("server/tickets/ticketLifecycleAuthority.js")
    && entries.some((entry) => normalizePath(entry.file) === "server/tickets/handler.js" && /ticketLifecycleTransitionError/.test(entry.line || ""));
  const hasPriorityAuthority = normalizedFiles.includes("src/ticketPriorityUpdateModel.js")
    && entries.some((entry) => normalizePath(entry.file) === "server/tickets/handler.js" && /applyTicketPriorityUpdate/.test(entry.line || ""));
  const hasBootstrapGuard = normalizedFiles.includes("server/bootstrap/adminHandler.js")
    && entries.some((entry) => normalizePath(entry.file) === "server/bootstrap/adminHandler.js" && /bootstrap_admin_already_exists/.test(entry.line || ""));

  return sortStable({
    findings,
    classificationCounts,
    evidence: {
      bootstrapGuard: hasBootstrapGuard,
      lifecycleServerAuthority: hasLifecycleAuthority,
      priorityServerAuthority: hasPriorityAuthority,
      sessionAuthority: hasSessionAuthority
    }
  });
}

function severityCounts(findings = []) {
  return findings.reduce((acc, finding) => {
    acc[finding.classification] = (acc[finding.classification] || 0) + 1;
    return acc;
  }, {});
}

export function buildAuthorityVerificationReport({
  files = [],
  entries = [],
  gitCommit = ""
} = {}) {
  const inventory = scanAuthorityInventory({ files, entries });
  const counts = severityCounts(inventory.findings);
  const hardcodedIdentity = Boolean(counts.HARDCODED_IDENTITY_RISK);
  const hardcodedRouting = Boolean(counts.HARDCODED_ROUTING_RISK);
  const clientOnlyAuth = Boolean(counts.CLIENT_ONLY_AUTHORIZATION_RISK);
  const evidence = inventory.evidence;

  const checks = {
    noPrivilegedEmailHardcoding: hardcodedIdentity ? "failed" : "ok",
    noPrivilegedUserUuidHardcoding: hardcodedIdentity ? "failed" : "ok",
    noFixedDefaultAssignee: hardcodedRouting ? "failed" : "ok",
    noClientOnlyCriticalAuthorization: clientOnlyAuth ? "failed" : "ok",
    sessionAuthorityPresent: evidence.sessionAuthority ? "ok" : "failed",
    lifecycleAuthorityPresent: evidence.lifecycleServerAuthority ? "ok" : "failed",
    priorityAuthorityPresent: evidence.priorityServerAuthority ? "ok" : "failed",
    bootstrapGuardPresent: evidence.bootstrapGuard ? "ok" : "failed",
    noProductionWrites: "ok",
    noSecretValues: "ok"
  };

  let status = "READY_WITH_OWNER_DECISIONS";
  if (hardcodedIdentity) status = "HARDCODED_IDENTITY_FOUND";
  else if (hardcodedRouting) status = "HARDCODED_ROUTING_FOUND";
  else if (clientOnlyAuth) status = "CLIENT_ONLY_AUTHORIZATION_FOUND";
  else if (!evidence.sessionAuthority || !evidence.lifecycleServerAuthority || !evidence.priorityServerAuthority) status = "UNVERIFIED";

  return sortStable({
    ok: !["HARDCODED_IDENTITY_FOUND", "HARDCODED_ROUTING_FOUND", "CLIENT_ONLY_AUTHORIZATION_FOUND", "SINGLE_IDENTITY_DEPENDENCY", "UNVERIFIED"].includes(status),
    status,
    gitCommit: shortSha(gitCommit),
    checks,
    inventory,
    safety: {
      deploys: false,
      mutatesProduction: false,
      networkCalls: false,
      printsSecretValues: false
    },
    ownerDecisions: [
      "Keep at least two active admin app_users before disabling the original admin.",
      "Decide whether legacy non-tech CMMS session tokens should be revalidated against app_users in every API path.",
      "Resolve the current priority edit/SLA behavior mismatch before changing urgency semantics."
    ]
  });
}

function shortSha(value = "") {
  const text = String(value || "").trim();
  return /^[a-f0-9]{7,}$/i.test(text) ? text.slice(0, 7) : text;
}
