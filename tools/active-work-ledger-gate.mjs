import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { activeWorkLedgerPolicy, effectiveLedgerBranch } from "../src/activeWorkLedgerModel.js";

function git(args, { silent = false } = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", silent ? "ignore" : "pipe"]
  }).trim();
}

function gitOptional(args) {
  try {
    return git(args, { silent: true });
  } catch {
    return "";
  }
}

const cwd = process.cwd();
const content = readFileSync(join(cwd, "docs", "active-work.md"), "utf8");
const gitBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const currentBranch = effectiveLedgerBranch({ gitBranch, githubHeadRef: process.env.GITHUB_HEAD_REF });
const headSha = git(["rev-parse", "--short", "HEAD"]);
const originMainSha = gitOptional(["rev-parse", "--short", "origin/main"]);
const statusShort = gitOptional(["status", "--porcelain"]);

const result = activeWorkLedgerPolicy({
  content,
  currentBranch,
  headSha,
  originMainSha,
  statusShort
});

if (!result.ok) {
  console.error("[active-work-ledger] failed");
  for (const error of result.errors) console.error(`- ${error}`);
  console.error("Update docs/active-work.md so it reflects the real current branch/main state.");
  process.exit(1);
}

console.log(`[active-work-ledger] ok: branch=${currentBranch}, active=${result.activeBranch || "none"}`);
