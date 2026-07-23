export const REQUIRED_OPERATION_DOCS = Object.freeze([
  "docs/current-state.md",
  "docs/operations/README.md",
  "docs/operations/runbook-index.md",
  "docs/operations/production-change-policy.md",
  "docs/operations/business-continuity-guide.md",
  "docs/operations/access-and-dependency-register.md",
  "docs/operations/environment-reference.md",
  "docs/operations/documentation-inventory.md",
  "docs/operations/checklists/daily-health.md",
  "docs/operations/checklists/release.md",
  "docs/operations/checklists/incident.md",
  "docs/operations/checklists/quarterly-readiness.md"
]);

const CANONICAL_DOC_PREFIXES = Object.freeze(["README.md", "docs/current-state.md", "docs/operations/"]);
const EXPECTED_PRODUCTION_DOMAIN = "https://facility-maintenance-system.vercel.app";
const HISTORICAL_DOCS = Object.freeze([
  "docs/active-work.md",
  "docs/current-status.md",
  "docs/handoff-for-next-codex.md",
  "docs/handoffs/inline-ai-ticket-intake-handoff.md",
  "docs/audits/system-errors-and-user-feedback-review-2026-07-20.md"
]);
const UNSUPPORTED_COMMANDS = Object.freeze([
  /git\s+reset\s+--hard/i,
  /git\s+push\s+--force/i,
  /supabase\s+db\s+push(?!\s+--dry-run)/i,
  /vercel\s+env\s+(add|rm|remove|pull)/i,
  /vercel\s+alias\s+(set|rm|remove)/i,
  /vercel\s+rollback/i,
  /rm\s+-rf\s+\//i
]);

export function verifyOperationsDocs({
  files = {},
  required = REQUIRED_OPERATION_DOCS,
  productionDomain = EXPECTED_PRODUCTION_DOMAIN
} = {}) {
  const errors = [];
  const warnings = [];
  const checkedFiles = Object.keys(files).sort();
  const canonicalFiles = checkedFiles.filter(isCanonicalOperationalFile);

  const missing = required.filter((file) => !Object.prototype.hasOwnProperty.call(files, file));
  for (const file of missing) errors.push(`missing_canonical_doc:${file}`);

  const links = [];
  const duplicateRunbookLinks = duplicateCanonicalRunbookLinks(files["docs/operations/runbook-index.md"] || "");
  for (const duplicate of duplicateRunbookLinks) errors.push(`duplicate_runbook_path:${duplicate}`);

  for (const file of canonicalFiles) {
    const text = String(files[file] || "");
    for (const localPath of findLocalAbsolutePaths(text)) errors.push(`local_absolute_path:${file}:${localPath}`);
    for (const secret of findSecretLikeValues(text)) errors.push(`secret_like_value:${file}:${secret}`);
    for (const command of findUnsupportedCommands(text)) errors.push(`unsupported_command:${file}:${command}`);
    for (const domain of findProductionDomains(text)) {
      if (domain !== productionDomain) errors.push(`contradictory_production_domain:${file}:${domain}`);
    }
    for (const stale of findStaleCurrentShaClaims(text)) errors.push(`stale_current_sha_claim:${file}:${stale}`);
    links.push(...extractMarkdownLinks(file, text));
  }

  for (const link of links) {
    if (!link.target) continue;
    if (isExternalLink(link.target)) continue;
    const resolved = resolveMarkdownLink(link.file, link.target);
    if (!Object.prototype.hasOwnProperty.call(files, resolved.file)) {
      errors.push(`broken_link:${link.file}:${link.target}`);
      continue;
    }
    if (resolved.anchor && !markdownHasAnchor(files[resolved.file], resolved.anchor)) {
      errors.push(`broken_anchor:${link.file}:${link.target}`);
    }
  }

  const ownerMarkers = canonicalFiles.reduce((count, file) => count + countMatches(files[file], /OWNER TO DEFINE/g), 0);
  if (ownerMarkers === 0) errors.push("owner_decision_markers_missing");

  for (const historical of HISTORICAL_DOCS) {
    const inventory = files["docs/operations/documentation-inventory.md"] || "";
    const escaped = historical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const row = new RegExp(`\\|\\s*\\\`${escaped}\\\`\\s*\\|\\s*\\\`(HISTORICAL|SUPERSEDED|CURRENT_WITH_GAPS)\\\``, "m");
    if (!row.test(inventory)) errors.push(`historical_doc_not_classified:${historical}`);
  }

  return stableObject({
    ok: errors.length === 0,
    status: errors.length === 0 ? "ready" : "failed",
    checkedFiles: canonicalFiles,
    requiredFiles: [...required],
    linksChecked: links.length,
    ownerDecisionMarkers: ownerMarkers,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    safety: {
      deploys: false,
      networkCalls: false,
      mutatesProduction: false,
      printsSecretValues: false
    }
  });
}

export function stableJson(value) {
  return JSON.stringify(stableObject(value), null, 2);
}

export function isCanonicalOperationalFile(file = "") {
  const path = normalizePath(file);
  return CANONICAL_DOC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function extractMarkdownLinks(file = "", text = "") {
  const links = [];
  const source = String(text || "");
  for (const match of source.matchAll(/!?\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = String(match[1] || "").trim();
    const target = raw.split(/\s+/)[0].replace(/^<|>$/g, "");
    links.push({ file: normalizePath(file), target });
  }
  return links;
}

export function resolveMarkdownLink(file = "", target = "") {
  const [pathPart, anchor = ""] = String(target || "").split("#");
  const baseDir = dirname(normalizePath(file));
  const normalized = normalizePath(joinPath(baseDir, decodeURIComponent(pathPart || "")));
  return { file: normalized, anchor: normalizeAnchor(anchor) };
}

export function findLocalAbsolutePaths(text = "") {
  return [...String(text || "").matchAll(/\/Users\/[^\s)`]+|\/private\/tmp\/[^\s)`]+/g)].map((match) => match[0]);
}

export function findProductionDomains(text = "") {
  return [...new Set([...String(text || "").matchAll(/https:\/\/[A-Za-z0-9.-]*(?:facility-maintenance-system|ogen)[A-Za-z0-9.-]*(?:\/[^\s)`]*)?/g)].map((match) => {
    try {
      const url = new URL(match[0]);
      return `${url.protocol}//${url.host}`;
    } catch {
      return match[0].replace(/\/+$/, "");
    }
  }))];
}

export function findStaleCurrentShaClaims(text = "") {
  const claims = [];
  const source = String(text || "");
  const staleShaPattern = /\b(b052082|97e6da4|dd58142|ae2abb4|82dee99)\b/g;
  for (const match of source.matchAll(staleShaPattern)) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(source.length, match.index + 80);
    const context = source.slice(start, end);
    if (/\b(current|production|live|baseline|HEAD|origin\/main)\b/i.test(context) && !/\b(old|older|historical|replaced|audit-time|R11\.5|R8|evidence)\b/i.test(context)) {
      claims.push(match[1]);
    }
  }
  return claims;
}

export function findSecretLikeValues(text = "") {
  const findings = [];
  const source = String(text || "");
  const assignmentPattern = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|SERVICE_ROLE_KEY|API_KEY)[A-Z0-9_]*)\s*=\s*([^\s`]+)/g;
  for (const match of source.matchAll(assignmentPattern)) {
    const value = String(match[2] || "");
    if (!value || /^<.*>$/.test(value) || /^(YOUR_|REPLACE_WITH|CHANGE_ME|abcdef|example|placeholder)/i.test(value)) continue;
    findings.push(`${match[1]}=<redacted>`);
  }
  for (const match of source.matchAll(/\b(sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{24,})\b/g)) {
    findings.push("<secret-like-token>");
  }
  return findings;
}

export function findUnsupportedCommands(text = "") {
  const findings = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    for (const pattern of UNSUPPORTED_COMMANDS) {
      if (pattern.test(line)) findings.push(line.trim());
    }
  }
  return findings;
}

function duplicateCanonicalRunbookLinks(text = "") {
  const seen = new Set();
  const duplicates = new Set();
  for (const link of extractMarkdownLinks("docs/operations/runbook-index.md", text)) {
    if (!link.target || isExternalLink(link.target)) continue;
    const resolved = resolveMarkdownLink("docs/operations/runbook-index.md", link.target).file;
    if (seen.has(resolved)) duplicates.add(resolved);
    seen.add(resolved);
  }
  return [...duplicates].sort();
}

function markdownHasAnchor(text = "", anchor = "") {
  if (!anchor) return true;
  const wanted = normalizeAnchor(anchor);
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match && normalizeAnchor(match[2]) === wanted) return true;
  }
  return false;
}

function normalizeAnchor(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function isExternalLink(target = "") {
  return /^(https?:|mailto:|#)/i.test(String(target || ""));
}

function countMatches(text = "", pattern) {
  return [...String(text || "").matchAll(pattern)].length;
}

function normalizePath(file = "") {
  const parts = [];
  for (const part of String(file || "").replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function dirname(file = "") {
  const normalized = normalizePath(file);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function joinPath(base = "", target = "") {
  if (!base) return target;
  return `${base}/${target}`;
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stableObject(value[key]);
    return acc;
  }, {});
}
