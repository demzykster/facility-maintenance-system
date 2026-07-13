import { describe, expect, it } from "vitest";
import { normalizeAiPanelAssistantOutput } from "../src/AIPanel.jsx";

describe("AI panel response model", () => {
  it("keeps legacy string assistant responses working", () => {
    expect(normalizeAiPanelAssistantOutput("תשובה קצרה")).toEqual({
      text: "תשובה קצרה",
      actions: []
    });
  });

  it("preserves structured action proposals from the server assistant", () => {
    const action = {
      id: "create_ticket",
      type: "ticket.create",
      requiresConfirmation: true,
      writesData: false
    };

    expect(normalizeAiPanelAssistantOutput({
      text: "הכנתי טיוטה.",
      actions: [action, null, "bad"]
    })).toEqual({
      text: "הכנתי טיוטה.",
      actions: [action]
    });
  });
});
