import { describe, expect, it } from "vitest";
import {
  buildAuthorityVerificationReport,
  classifyAuthorityEntry,
  scanAuthorityInventory,
  stableAuthorityJson
} from "../src/authorityVerificationModel.js";

const baseFiles = [
  "server/session/sessionHandler.js",
  "server/tickets/handler.js",
  "server/tickets/ticketLifecycleAuthority.js",
  "server/bootstrap/adminHandler.js",
  "src/supabaseProfileModel.js",
  "src/ticketPriorityUpdateModel.js",
  "tests/ticketLifecycleAuthority.test.js",
  "docs/production-bootstrap.md"
];

const authorityEntries = [
  { file: "server/tickets/handler.js", line: "import { ticketLifecycleTransitionError } from './ticketLifecycleAuthority.js';" },
  { file: "server/tickets/handler.js", line: "const priority = applyTicketPriorityUpdate(existingTicket, nextPriority, context);" },
  { file: "server/bootstrap/adminHandler.js", line: "return json(res, 409, { error: 'bootstrap_admin_already_exists' });" },
  { file: "tests/sessionHandler.test.js", line: "email: 'admin@example.com'" },
  { file: "src/ClaudeMaintenanceApp.jsx", line: "if (SEED_POLICY.allowBuiltinDemoUsers) users.push({ email: 'owner@example.local' });" }
];

describe("identity and authority verifier", () => {
  it("keeps fixture and demo bootstrap identities out of production findings", () => {
    expect(classifyAuthorityEntry({
      file: "tests/sessionHandler.test.js",
      line: "email: 'admin@example.com'"
    })).toBe("TEST_FIXTURE_ONLY");
    expect(classifyAuthorityEntry({
      file: "src/ClaudeMaintenanceApp.jsx",
      line: "if (SEED_POLICY.allowBuiltinDemoUsers) users.push({ email: 'owner@example.local' });"
    })).toBe("BOOTSTRAP_DEMO_ONLY");
  });

  it("reports current repository authority evidence without privileged identity risk", () => {
    const report = buildAuthorityVerificationReport({
      files: baseFiles,
      entries: authorityEntries,
      gitCommit: "24213dc1111111111111111111111111111111111"
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("READY_WITH_OWNER_DECISIONS");
    expect(report.checks).toMatchObject({
      noPrivilegedEmailHardcoding: "ok",
      noPrivilegedUserUuidHardcoding: "ok",
      noFixedDefaultAssignee: "ok",
      noClientOnlyCriticalAuthorization: "ok",
      lifecycleAuthorityPresent: "ok",
      priorityAuthorityPresent: "ok",
      sessionAuthorityPresent: "ok"
    });
    expect(JSON.parse(stableAuthorityJson(report))).toMatchObject({ gitCommit: "24213dc" });
  });

  it("detects privileged email allowlists in production code", () => {
    const report = buildAuthorityVerificationReport({
      files: baseFiles,
      entries: [
        ...authorityEntries,
        { file: "server/session/sessionHandler.js", line: "const privilegedAdmins = ['owner@example.com'];" }
      ]
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("HARDCODED_IDENTITY_FOUND");
    expect(report.checks.noPrivilegedEmailHardcoding).toBe("failed");
  });

  it("detects fixed privileged UUID comparisons in production code", () => {
    const report = buildAuthorityVerificationReport({
      files: baseFiles,
      entries: [
        ...authorityEntries,
        { file: "server/session/sessionHandler.js", line: "if (user.id === '123e4567-e89b-12d3-a456-426614174000') return 'admin';" }
      ]
    });

    expect(report.status).toBe("HARDCODED_IDENTITY_FOUND");
    expect(report.checks.noPrivilegedUserUuidHardcoding).toBe("failed");
  });

  it("detects fixed default routing assignments in production code", () => {
    const report = buildAuthorityVerificationReport({
      files: baseFiles,
      entries: [
        ...authorityEntries,
        { file: "server/tickets/handler.js", line: "const ticket = { assignee: 'Vadim' };" }
      ]
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("HARDCODED_ROUTING_FOUND");
    expect(report.checks.noFixedDefaultAssignee).toBe("failed");
  });

  it("detects actor authority copied from untrusted payload", () => {
    const report = buildAuthorityVerificationReport({
      files: baseFiles,
      entries: [
        ...authorityEntries,
        { file: "server/tickets/handler.js", line: "const actorId = body.actorId;" }
      ]
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("CLIENT_ONLY_AUTHORIZATION_FOUND");
    expect(report.checks.noClientOnlyCriticalAuthorization).toBe("failed");
  });

  it("keeps a stable classified inventory", () => {
    const inventory = scanAuthorityInventory({
      files: baseFiles,
      entries: [
        ...authorityEntries,
        { file: "docs/production-bootstrap.md", line: "The first admin bootstrap is owner-approved." }
      ]
    });

    expect(inventory.evidence.bootstrapGuard).toBe(true);
    expect(inventory.classificationCounts.DOCUMENTATION_ONLY).toBeGreaterThan(0);
    expect(inventory.findings).toEqual([]);
  });
});
