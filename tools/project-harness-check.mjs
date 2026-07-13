import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = process.cwd();
const MONOLITH_FILE = "src/ClaudeMaintenanceApp.jsx";
const MONOLITH_BASELINE_LINES = 9957;
const MONOLITH_BASELINE_SHA256 = "c615cd638bda0e4f89f50e646ed94c8576f6aa5ea4edb50c26b4004bd5c2494c";

const CANONICAL_FILES = Object.freeze([
  "AGENTS.md",
  "docs/current-state.md",
  "docs/architecture-rules.md",
  "docs/decisions/ADR-0001-risk-based-ai-autonomy.md",
  "docs/decisions/ADR-0002-incremental-monolith-extraction.md",
  "docs/decisions/ADR-0003-bi-unified-decision-shell.md",
  "docs/decisions/ADR-0004-provider-neutral-ai-boundary.md",
  "docs/templates/vertical-slice-extraction.md",
  "docs/extraction-residue-checks.json",
  "docs/monolith-growth-exceptions.md"
]);

const AGENT_REQUIRED_REFS = Object.freeze([
  "docs/current-state.md",
  "docs/architecture-rules.md",
  "docs/decisions/",
  "docs/templates/vertical-slice-extraction.md"
]);

const ALLOWED_PROVIDER_SDK_IMPORT_FILES = new Set([
  "server/ai/providerClient.js"
]);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".vercel"
]);

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

function relPath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function readText(root, file) {
  return readFileSync(path.join(root, file), "utf8");
}

function lineCount(text) {
  if (!text) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function walkFiles(root, dir = root, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(root, full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function ensure(condition, message, errors) {
  if (!condition) errors.push(message);
}

function checkCanonicalFiles(root, errors) {
  for (const file of CANONICAL_FILES) {
    ensure(existsSync(path.join(root, file)), `missing canonical harness file: ${file}`, errors);
  }
}

function checkAgentsReferences(root, errors) {
  const agents = readText(root, "AGENTS.md");
  for (const ref of AGENT_REQUIRED_REFS) {
    ensure(agents.includes(ref), `AGENTS.md must reference ${ref}`, errors);
    ensure(existsSync(path.join(root, ref)), `AGENTS.md references missing path: ${ref}`, errors);
  }
}

function checkProviderBoundary(root, errors) {
  const importRe = /\bfrom\s+["'](?:ai|@ai-sdk\/[^"']+)["']|import\s*\(\s*["'](?:ai|@ai-sdk\/[^"']+)["']\s*\)/;
  for (const file of walkFiles(root)) {
    const relative = relPath(root, file);
    if (!SOURCE_EXTENSIONS.has(path.extname(relative))) continue;
    const text = readFileSync(file, "utf8");
    if (!importRe.test(text)) continue;
    ensure(
      ALLOWED_PROVIDER_SDK_IMPORT_FILES.has(relative),
      `provider SDK import outside AI boundary: ${relative}`,
      errors
    );
  }
}

function checkMonolithBaseline(root, errors) {
  const text = readText(root, MONOLITH_FILE);
  const lines = lineCount(text);
  const exceptionText = readText(root, "docs/monolith-growth-exceptions.md");
  const hasCurrentException = new RegExp(`new line count:\\s*${lines}\\b`, "i").test(exceptionText)
    || new RegExp(`- New line count:\\s*${lines}\\b`, "i").test(exceptionText);

  ensure(
    exceptionText.includes(`Lines: ${MONOLITH_BASELINE_LINES}`),
    "monolith baseline lines are missing from docs/monolith-growth-exceptions.md",
    errors
  );
  ensure(
    exceptionText.includes(MONOLITH_BASELINE_SHA256),
    "monolith baseline sha is missing from docs/monolith-growth-exceptions.md",
    errors
  );
  ensure(
    lines <= MONOLITH_BASELINE_LINES || hasCurrentException,
    `${MONOLITH_FILE} grew from baseline ${MONOLITH_BASELINE_LINES} to ${lines}; document a current-goal exception in docs/monolith-growth-exceptions.md`,
    errors
  );
}

function checkExtractionResidueConfig(root, errors) {
  const config = JSON.parse(readText(root, "docs/extraction-residue-checks.json"));
  ensure(Array.isArray(config.checks), "docs/extraction-residue-checks.json must contain a checks array", errors);
  for (const check of config.checks || []) {
    const name = check.name || "unnamed residue check";
    ensure(Boolean(check.why), `residue check "${name}" must explain why it exists`, errors);
    for (const file of check.requiredFiles || []) {
      ensure(existsSync(path.join(root, file)), `residue check "${name}" missing required file: ${file}`, errors);
    }
    for (const item of check.requiredText || []) {
      const text = existsSync(path.join(root, item.file)) ? readText(root, item.file) : "";
      ensure(text.includes(item.text), `residue check "${name}" missing required text in ${item.file}: ${item.text}`, errors);
    }
    for (const item of check.forbiddenText || []) {
      const text = existsSync(path.join(root, item.file)) ? readText(root, item.file) : "";
      ensure(!text.includes(item.text), `residue check "${name}" found forbidden text in ${item.file}: ${item.text}`, errors);
    }
  }
}

function checkTemporaryAdapters(root, errors) {
  const adapterRe = /TEMP_ADAPTER|temporary adapter/i;
  const removalRe = /REMOVE_WHEN|removal condition|remove when|condition/i;
  for (const file of walkFiles(root)) {
    const relative = relPath(root, file);
    if (!SOURCE_EXTENSIONS.has(path.extname(relative)) && !relative.endsWith(".md")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!adapterRe.test(line)) return;
      const window = lines.slice(index, Math.min(lines.length, index + 6)).join("\n");
      ensure(removalRe.test(window), `temporary adapter in ${relative}:${index + 1} needs a removal condition`, errors);
    });
  }
}

export function runProjectHarnessCheck(root = DEFAULT_ROOT) {
  const errors = [];
  checkCanonicalFiles(root, errors);
  if (!errors.length) {
    checkAgentsReferences(root, errors);
    checkProviderBoundary(root, errors);
    checkMonolithBaseline(root, errors);
    checkExtractionResidueConfig(root, errors);
    checkTemporaryAdapters(root, errors);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
  const errors = runProjectHarnessCheck(root);
  if (errors.length) {
    console.error("[project-harness] failed");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("[project-harness] ok");
}

