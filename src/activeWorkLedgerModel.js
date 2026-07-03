const ACTIVE_BRANCH_RE = /^-\s*Active branch:\s*(.+?)\s*$/im;
const PINNED_MAIN_RE = /\b(?:Main is currently at|Current main:)\s*`?([0-9a-f]{7,40})`?/gi;
const CURRENT_BRANCH_WORK_RE = /^-\s*(?:Current branch change|Current branch work|Current validation for PR|Current branch validation target):/im;

export function normalizeLedgerBranch(value) {
  if (!value) return null;
  const clean = String(value)
    .replace(/[`.]/g, "")
    .trim()
    .toLowerCase();
  if (!clean || clean === "none" || clean === "no active branch" || clean === "no-active" || clean === "none active") {
    return null;
  }
  return String(value).replace(/[`.]/g, "").trim();
}

export function extractActiveLedgerBranch(content) {
  const match = ACTIVE_BRANCH_RE.exec(content || "");
  return normalizeLedgerBranch(match?.[1]);
}

export function extractPinnedMainShas(content) {
  const shas = [];
  for (const match of String(content || "").matchAll(PINNED_MAIN_RE)) {
    shas.push(match[1].toLowerCase());
  }
  return [...new Set(shas)];
}

export function effectiveLedgerBranch({ gitBranch, githubHeadRef } = {}) {
  const headRef = String(githubHeadRef || "").trim();
  if (headRef) return headRef;
  return String(gitBranch || "").trim();
}

export function activeWorkLedgerPolicy({
  content,
  currentBranch,
  headSha,
  originMainSha,
  statusShort = ""
} = {}) {
  const errors = [];
  const activeBranch = extractActiveLedgerBranch(content);
  const pinnedMainShas = extractPinnedMainShas(content);
  const branch = currentBranch || "";
  const isClean = !String(statusShort || "").trim();
  const expectedMainSha = (originMainSha || (branch === "main" ? headSha : "") || "").toLowerCase();

  if (activeBranch && branch === "main") {
    errors.push(`active_work_points_to_branch_on_main:${activeBranch}`);
  } else if (activeBranch && branch && activeBranch !== branch) {
    errors.push(`active_work_branch_mismatch:${activeBranch}!=${branch}`);
  }

  if (activeBranch && branch === "main" && isClean) {
    errors.push("active_work_claims_unmerged_branch_but_main_is_clean");
  }

  if (!activeBranch && branch === "main" && isClean && CURRENT_BRANCH_WORK_RE.test(content || "")) {
    errors.push("active_work_has_current_branch_work_without_active_branch");
  }

  if (expectedMainSha) {
    for (const pinned of pinnedMainShas) {
      if (!expectedMainSha.startsWith(pinned) && !pinned.startsWith(expectedMainSha)) {
        errors.push(`active_work_pins_stale_main:${pinned}!=${expectedMainSha.slice(0, 7)}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    activeBranch,
    pinnedMainShas
  };
}
