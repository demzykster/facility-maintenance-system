import { describe, expect, it } from "vitest";
import {
  REQUIRED_ARCHITECTURE_INVENTORY_DOCS,
  REQUIRED_CANONICAL_DOCS,
  extractMarkdownLinks,
  findLocalAbsolutePaths,
  findSecretLikeValues,
  findStaleCurrentShaClaims,
  resolveMarkdownLink,
  stableJson,
  verifyOperationsDocs
} from "../src/docsVerificationModel.js";

const completeFiles = Object.fromEntries(REQUIRED_CANONICAL_DOCS.map((file) => [file, `# ${file}\n\nOWNER TO DEFINE\n`]));
completeFiles["README.md"] = "# README\n\nSee [Ops](docs/operations/README.md).\n";
completeFiles["docs/operations/README.md"] = "# Operations\n\nOWNER TO DEFINE\n\nSee [Runbook](runbook-index.md).\n";
completeFiles["docs/operations/runbook-index.md"] = "# Runbook\n\nOWNER TO DEFINE\n\n| Area | Canonical file |\n|---|---|\n| Daily | [Daily](checklists/daily-health.md) |\n";
completeFiles["docs/operations/documentation-inventory.md"] = `# Inventory

| Document | Status | Notes |
|---|---|---|
| \`docs/active-work.md\` | \`HISTORICAL\` | ledger |
| \`docs/current-status.md\` | \`HISTORICAL\` | archive |
| \`docs/handoff-for-next-codex.md\` | \`HISTORICAL\` | handoff |
| \`docs/handoffs/inline-ai-ticket-intake-handoff.md\` | \`HISTORICAL\` | handoff |
| \`docs/audits/system-errors-and-user-feedback-review-2026-07-20.md\` | \`HISTORICAL\` | audit |
`;

describe("docs verification model", () => {
  it("requires operations entry point and canonical files", () => {
    const result = verifyOperationsDocs({ files: {} });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing_canonical_doc:docs/operations/README.md");
  });

  it("requires responsibility, event, notification, and sync inventory docs", () => {
    const result = verifyOperationsDocs({ files: {} });

    for (const file of REQUIRED_ARCHITECTURE_INVENTORY_DOCS) {
      expect(result.errors).toContain(`missing_canonical_doc:${file}`);
    }
  });

  it("resolves internal markdown links", () => {
    expect(extractMarkdownLinks("docs/operations/README.md", "See [Runbook](runbook-index.md).")).toEqual([
      { file: "docs/operations/README.md", target: "runbook-index.md" }
    ]);
    expect(resolveMarkdownLink("docs/operations/README.md", "../current-state.md")).toEqual({
      file: "docs/current-state.md",
      anchor: ""
    });

    const result = verifyOperationsDocs({ files: completeFiles });
    expect(result.errors).not.toContain("broken_link:docs/operations/README.md:runbook-index.md");
  });

  it("rejects local absolute paths in canonical docs", () => {
    expect(findLocalAbsolutePaths("Repo at /Users/Vadim/Documents/CMMS")).toEqual(["/Users/Vadim/Documents/CMMS"]);
    const result = verifyOperationsDocs({
      files: { ...completeFiles, "docs/operations/README.md": "# Ops\n/Users/Vadim/Documents/CMMS\nOWNER TO DEFINE\n" }
    });

    expect(result.errors.some((error) => error.startsWith("local_absolute_path:docs/operations/README.md"))).toBe(true);
  });

  it("treats architecture inventories as canonical docs", () => {
    const result = verifyOperationsDocs({
      files: {
        ...completeFiles,
        "docs/architecture/responsibility-inventory.md": "# Responsibility\n\nOWNER TO DEFINE\n\n/Users/Vadim/Documents/CMMS\n"
      }
    });

    expect(result.errors.some((error) => error.startsWith("local_absolute_path:docs/architecture/responsibility-inventory.md"))).toBe(true);
  });

  it("detects secret-like content without blocking env names", () => {
    expect(findSecretLikeValues("SUPABASE_SERVICE_ROLE_KEY")).toEqual([]);
    expect(findSecretLikeValues("SUPABASE_SERVICE_ROLE_KEY=actual-secret-value")).toEqual(["SUPABASE_SERVICE_ROLE_KEY=<redacted>"]);
  });

  it("detects stale current SHA wording", () => {
    expect(findStaleCurrentShaClaims("Current production SHA is b052082.")).toEqual(["b052082"]);
    expect(findStaleCurrentShaClaims("Historical evidence mentioned b052082.")).toEqual([]);
  });

  it("enforces production domain consistency", () => {
    const result = verifyOperationsDocs({
      files: {
        ...completeFiles,
        "docs/operations/README.md": "# Ops\n\nOWNER TO DEFINE\n\nProduction: https://old-ogen.example.com\n"
      }
    });

    expect(result.errors.some((error) => error.includes("contradictory_production_domain"))).toBe(true);
  });

  it("fails when a canonical doc is missing", () => {
    const files = { ...completeFiles };
    delete files["docs/operations/checklists/release.md"];

    expect(verifyOperationsDocs({ files }).errors).toContain("missing_canonical_doc:docs/operations/checklists/release.md");
  });

  it("preserves owner decision placeholders", () => {
    const files = Object.fromEntries(Object.entries(completeFiles).map(([file, text]) => [file, text.replace(/OWNER TO DEFINE/g, "")]));
    const result = verifyOperationsDocs({ files });

    expect(result.errors).toContain("owner_decision_markers_missing");
  });

  it("returns stable JSON", () => {
    const first = stableJson(verifyOperationsDocs({ files: completeFiles }));
    const second = stableJson(verifyOperationsDocs({ files: completeFiles }));

    expect(first).toBe(second);
  });

  it("does not execute deploy or write commands", () => {
    const result = verifyOperationsDocs({ files: completeFiles });

    expect(result.safety).toEqual({
      deploys: false,
      mutatesProduction: false,
      networkCalls: false,
      printsSecretValues: false
    });
  });

  it("requires historical docs to stay classified as non-current", () => {
    const files = {
      ...completeFiles,
      "docs/operations/documentation-inventory.md": "# Inventory\n\nNo table yet.\n"
    };
    const result = verifyOperationsDocs({ files });

    expect(result.errors).toContain("historical_doc_not_classified:docs/active-work.md");
  });
});
