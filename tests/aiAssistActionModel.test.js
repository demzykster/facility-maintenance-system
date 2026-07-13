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

  it("turns a clear task draft into a human-confirmed task proposal without writing", () => {
    const draft = buildAiIntakeDraft({
      rawText: "משימה לבדוק הצעת מחיר למלגזה",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_task",
        type: "task.create",
        label: "יצירת משימה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        writePolicy: "human_confirmation_required",
        missingFields: [],
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "tasks",
          bodyField: "task"
        },
        payload: expect.objectContaining({
          title: "משימה לבדוק הצעת מחיר למלגזה",
          desc: "משימה לבדוק הצעת מחיר למלגזה",
          status: "todo",
          priority: "medium",
          sourceModule: "ai_assist",
          ownerId: "u1",
          responsibleIds: ["u1"],
          createdAt: 2000,
          updatedAt: 2000,
          createdBy: expect.objectContaining({
            id: "u1",
            name: "Vadim",
            role: "admin"
          }),
          ai: expect.objectContaining({
            drafted: true,
            source: "ai_assist"
          })
        })
      })
    ]);
  });

  it("turns a clear meeting draft into a human-confirmed meeting proposal without writing", () => {
    const draft = buildAiIntakeDraft({
      rawText: "פגישה מחר ב-09:00 לעבור על תקלות בטיחות",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_meeting",
        type: "meeting.create",
        label: "יצירת פגישה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        writePolicy: "human_confirmation_required",
        missingFields: [],
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "meetings",
          bodyField: "meeting"
        },
        payload: expect.objectContaining({
          title: "פגישה מחר ב-09:00 לעבור על תקלות בטיחות",
          type: "boss",
          status: "planned",
          ownerId: "u1",
          participantIds: ["u1"],
          at: 2000 + 86400000,
          createdAt: 2000,
          updatedAt: 2000,
          ai: expect.objectContaining({
            drafted: true,
            source: "ai_assist"
          })
        })
      })
    ]);
  });

  it("proposes a constrained task.update only when a single visible task target is clear", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את המשימה לעדיפות גבוהה וסטטוס בטיפול",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tasks: [{ id: "task-1", title: "בדיקת ספק", priority: "medium", status: "todo" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-1",
        type: "task.update",
        label: "עדכון משימה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          taskId: "task-1",
          taskTitle: "בדיקת ספק",
          current: { priority: "medium", status: "todo" },
          patch: { priority: "high", status: "in_progress" }
        },
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "tasks",
          bodyField: "task"
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tasks: [
          { id: "task-1", title: "בדיקת ספק", priority: "medium", status: "todo" },
          { id: "task-2", title: "משימה אחרת", priority: "medium", status: "todo" }
        ]
      }
    })).toEqual([]);
  });

  it("proposes task due-date updates only from explicit relative dates", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את המשימה למחר",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tasks: [{ id: "task-1", title: "בדיקת ספק", priority: "medium", status: "todo", dueAt: null }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-1",
        type: "task.update",
        payload: {
          taskId: "task-1",
          taskTitle: "בדיקת ספק",
          current: { dueAt: null },
          patch: { dueAt: 2000 + 86400000 }
        }
      })
    ]);
  });

  it("proposes a constrained ticket.update only when a single visible ticket target is clear", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה לעדיפות גבוהה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", priority: "medium", status: "new" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        label: "עדכון קריאה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { priority: "medium" },
          patch: { priority: "high" }
        },
        execute: {
          method: "POST",
          path: "/api/tickets",
          bodyField: "ticket"
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [
          { id: "T-1", priority: "medium" },
          { id: "T-2", priority: "medium" }
        ]
      }
    })).toEqual([]);
  });

  it("proposes supplier routing only when the supplier is visible and explicitly named", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעביר את הקריאה לספק Toyota",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", priority: "medium", status: "new", supplier: "" }],
        suppliers: [
          { name: "Toyota", type: "transport", scopes: ["transport"] },
          { name: "BuildingCo", type: "facility", scopes: ["facility:hvac"] }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        label: "עדכון קריאה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "תקלה במלגזה",
          current: { supplier: "" },
          patch: { supplier: "Toyota" }
        },
        execute: {
          method: "POST",
          path: "/api/tickets",
          bodyField: "ticket"
        }
      })
    ]);
  });

  it("proposes waiting status updates only with an explicit waiting reason", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה להמתנה לחלקים",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", status: "in_progress", waitingReason: "", waitBall: "" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        payload: {
          ticketId: "T-1",
          ticketTitle: "תקלה במלגזה",
          current: { status: "in_progress", waitingReason: "", waitBall: "" },
          patch: { status: "waiting", waitingReason: "parts", waitBall: "executor" }
        }
      })
    ]);
  });

  it("does not propose a generic waiting update without a clear reason", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה להמתנה",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", status: "in_progress" }]
      }
    })).toEqual([]);
  });

  it("clears waiting reason fields when moving a waiting ticket back to work", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה לסטטוס בטיפול",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", status: "waiting", waitingReason: "parts", waitBall: "executor" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        payload: {
          ticketId: "T-1",
          ticketTitle: "תקלה במלגזה",
          current: { status: "waiting", waitingReason: "parts", waitBall: "executor" },
          patch: { status: "in_progress", waitingReason: null, waitBall: null }
        }
      })
    ]);
  });

  it("does not guess supplier routing from invisible, ambiguous, or unchanged suppliers", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעביר את הקריאה לספק Toyota",
      actor,
      language: "he"
    }, 1000);

    const ambiguousDraft = buildAiIntakeDraft({
      rawText: "תעביר את הקריאה לספק Toyota North",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft: ambiguousDraft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", supplier: "" }],
        suppliers: []
      }
    })).toEqual([]);

    expect(buildAiAssistActionProposals({
      draft: ambiguousDraft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", supplier: "" }],
        suppliers: [{ name: "Toyota" }, { name: "Toyota North" }]
      }
    })).toEqual([]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", supplier: "Toyota" }],
        suppliers: [{ name: "Toyota" }]
      }
    })).toEqual([]);
  });

  it("proposes a ticket.comment only for explicit note commands with a single visible ticket", () => {
    const draft = buildAiIntakeDraft({
      rawText: "הוסף הערה: דיברתי עם הספק וממתינים לתשובה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", priority: "medium", status: "new" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "comment_ticket_T-1",
        type: "ticket.comment",
        label: "הוספת הערה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          note: "דיברתי עם הספק וממתינים לתשובה"
        },
        execute: {
          method: "POST",
          path: "/api/tickets",
          bodyField: "ticket"
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [
          { id: "T-1", subject: "דליפת מים" },
          { id: "T-2", subject: "רעש במנוע" }
        ]
      }
    })).toEqual([]);
  });
});
