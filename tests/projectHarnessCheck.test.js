import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runProjectHarnessCheck } from "../tools/project-harness-check.mjs";

function makeRepo(files = {}) {
  const root = path.join(tmpdir(), `cmms-harness-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  return root;
}

const baselineHash = "c615cd638bda0e4f89f50e646ed94c8576f6aa5ea4edb50c26b4004bd5c2494c";

function baseFiles(overrides = {}) {
  const agentText = [
    "docs/current-state.md",
    "docs/architecture-rules.md",
    "docs/decisions/",
    "docs/templates/vertical-slice-extraction.md"
  ].join("\n");
  const residueConfig = JSON.stringify({
    checks: [
      {
        name: "sample",
        why: "prevents a real extraction regression",
        requiredFiles: ["src/Shared.jsx"],
        requiredText: [{ file: "src/Shared.jsx", text: "export function Shared" }],
        forbiddenText: [{ file: "src/ClaudeMaintenanceApp.jsx", text: "function Shared(" }]
      }
    ]
  });
  const files = {
    "AGENTS.md": agentText,
    "docs/current-state.md": "current",
    "docs/architecture-rules.md": "rules",
    "docs/decisions/ADR-0001-risk-based-ai-autonomy.md": "adr",
    "docs/decisions/ADR-0002-incremental-monolith-extraction.md": "adr",
    "docs/decisions/ADR-0003-bi-unified-decision-shell.md": "adr",
    "docs/decisions/ADR-0004-provider-neutral-ai-boundary.md": "adr",
    "docs/templates/vertical-slice-extraction.md": "template",
    "docs/extraction-residue-checks.json": residueConfig,
    "docs/monolith-growth-exceptions.md": `Lines: 9957\nSHA-256: \`${baselineHash}\`\n`,
    "src/ClaudeMaintenanceApp.jsx": "shell\n",
    "src/Shared.jsx": "export function Shared() {}\n",
    "server/ai/providerClient.js": "import { generateText } from \"ai\";\n"
  };
  return { ...files, ...overrides };
}

describe("project harness check", () => {
  it("accepts a minimal valid harness", () => {
    const root = makeRepo(baseFiles());
    expect(runProjectHarnessCheck(root)).toEqual([]);
  });

  it("rejects provider SDK imports outside the provider boundary", () => {
    const root = makeRepo(baseFiles({
      "src/AIPanel.jsx": "import { generateText } from \"ai\";\n"
    }));
    expect(runProjectHarnessCheck(root)).toContain("provider SDK import outside AI boundary: src/AIPanel.jsx");
  });

  it("rejects unexplained monolith growth", () => {
    const root = makeRepo(baseFiles({
      "src/ClaudeMaintenanceApp.jsx": Array.from({ length: 9958 }, (_, index) => `line ${index}`).join("\n")
    }));
    expect(runProjectHarnessCheck(root).join("\n")).toContain("grew from baseline 9957 to 9958");
  });

  it("applies extraction residue checks", () => {
    const root = makeRepo(baseFiles({
      "src/ClaudeMaintenanceApp.jsx": "function Shared() {}\n"
    }));
    expect(runProjectHarnessCheck(root).join("\n")).toContain("found forbidden text");
  });
});

