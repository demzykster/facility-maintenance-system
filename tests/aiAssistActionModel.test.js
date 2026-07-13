import { describe, expect, it } from "vitest";
import { buildAiIntakeDraft } from "../src/aiIntakeModel.js";
import { buildAiAssistActionProposals } from "../src/aiAssistActionModel.js";

const actor = { id: "u1", role: "admin", name: "Vadim" };

describe("AI assist action model", () => {
  it("turns a clear facility draft into a human-confirmed ticket proposal without writing", () => {
    const draft = buildAiIntakeDraft({
      rawText: "המזגן מטפטף באזור משרדים",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        execute: expect.objectContaining({
          method: "POST",
          path: "/api/tickets"
        }),
        payload: expect.objectContaining({
          track: "facility",
          subject: "המזגן מטפטף באזור משרדים",
          zone: "משרדים",
          status: "new",
          createdBy: expect.objectContaining({
            id: "u1",
            name: "Vadim",
            role: "admin"
          })
        })
      })
    ]);
  });

  it("keeps transport ticket proposals blocked until a human selects the asset", () => {
    const draft = buildAiIntakeDraft({
      rawText: "מלגזה תקועה באזור טעינה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_human_input",
        requiresConfirmation: true,
        writesData: false,
        missingFields: expect.arrayContaining(["forkliftId"]),
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "",
          zone: "טעינה"
        })
      })
    ]);
  });

  it("does not propose write actions for clarification-only drafts or unsupported modules", () => {
    const draft = buildAiIntakeDraft({
      rawText: "משהו לא ברור",
      module: "unknown",
      actor
    }, 1000);

    expect(buildAiAssistActionProposals({ draft, user: actor, now: 2000 })).toEqual([]);
  });
});
