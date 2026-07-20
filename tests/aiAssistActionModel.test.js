import { describe, expect, it } from "vitest";
import { buildAiIntakeDraft } from "../src/aiIntakeModel.js";
import { buildAiAssistActionProposals } from "../src/aiAssistActionModel.js";

const actor = { id: "u1", role: "admin", name: "Vadim" };

describe("AI assist action model", () => {
  it("turns remember-this requests into a human-confirmed personal memory proposal", () => {
    const actions = buildAiAssistActionProposals({
      draft: {
        action: "no_action",
        rawText: "Запомни: утренние окна обслуживания предпочтительнее для отдела Ops"
      },
      user: { id: "u1", role: "user" },
      now: 1784400000000
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_memory_fact",
        type: "memory.fact.create",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        writePolicy: "human_confirmation_required",
        payload: expect.objectContaining({
          scopeType: "personal",
          summary: "утренние окна обслуживания предпочтительнее для отдела Ops",
          sourceType: "ai_chat",
          confidence: "confirmed"
        }),
        execute: {
          method: "POST",
          path: "/api/ai/memory",
          bodyField: "fact"
        }
      })
    ]);
  });

  it("proposes a cleaning complaint only when a single visible zone is clear", () => {
    const draft = buildAiIntakeDraft({
      rawText: "הרצפה מלוכלכת במטבחון קומה 2",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: { ...actor, department: "ניקיון" },
      now: 2000,
      context: {
        cleaning: {
          zones: [
            { id: "zone-kitchen-2", name: "מטבחון קומה 2", location: "בניין A" },
            { id: "zone-wc-main", name: "שירותים ראשי", location: "בניין A" }
          ]
        }
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_cleaning_complaint_zone-kitchen-2",
        type: "cleaning.complaint.create",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        execute: {
          method: "POST",
          path: "/api/cleaning/records",
          resource: "complaints",
          bodyField: "complaint"
        },
        payload: expect.objectContaining({
          zoneId: "zone-kitchen-2",
          zoneName: "מטבחון קומה 2",
          kind: "dirty",
          text: "הרצפה מלוכלכת במטבחון קומה 2",
          reportedById: "u1",
          reportedByName: "Vadim",
          reportedByRole: "admin",
          noPhotoReason: expect.stringContaining("AI")
        })
      })
    ]);
  });

  it("keeps ambiguous cleaning complaints blocked until a human chooses the zone", () => {
    const draft = buildAiIntakeDraft({
      rawText: "יש לכלוך באזור",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        cleaning: {
          zones: [
            { id: "zone-a", name: "מטבחון" },
            { id: "zone-b", name: "שירותים" }
          ]
        }
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_cleaning_complaint",
        type: "cleaning.complaint.create",
        status: "needs_human_input",
        missingFields: ["zoneId"],
        payload: expect.objectContaining({
          zoneId: "",
          zoneName: ""
        })
      })
    ]);
  });

  it("proposes a self-service PPE request only from a unique visible catalog item", () => {
    const draft = buildAiIntakeDraft({
      rawText: "אני צריך אפוד זוהר",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: { ...actor, workerNo: "11032", department: "הפצה" },
      now: 2000,
      context: {
        ppe: {
          items: [
            { id: "vest", name: "אפוד זוהר", category: "hivis", sizes: ["אחיד"], totalStock: 4 },
            { id: "shoes", name: "נעלי בטיחות", category: "shoes", sizes: ["42"] }
          ]
        }
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ppe_request_vest",
        type: "ppe.request.create",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        execute: {
          method: "POST",
          path: "/api/ppe",
          resource: "requests",
          bodyField: "request"
        },
        payload: {
          workerId: "u1",
          workerName: "Vadim",
          workerNo: "11032",
          dept: "הפצה",
          lines: [
            { itemId: "vest", itemName: "אפוד זוהר", category: "hivis", size: "אחיד", qty: 1 }
          ],
          note: "אני צריך אפוד זוהר"
        }
      })
    ]);
  });

  it("blocks PPE request confirmation when the catalog item needs an explicit size", () => {
    const draft = buildAiIntakeDraft({
      rawText: "אני צריך נעלי בטיחות",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: { ...actor, workerNo: "11032", department: "הפצה" },
      now: 2000,
      context: {
        ppe: {
          items: [
            { id: "shoes", name: "נעלי בטיחות", category: "shoes", sizes: ["41", "42"] }
          ]
        }
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ppe_request_shoes",
        type: "ppe.request.create",
        status: "needs_human_input",
        missingFields: ["size"],
        payload: expect.objectContaining({
          lines: [
            { itemId: "shoes", itemName: "נעלי בטיחות", category: "shoes", size: "", qty: 1 }
          ]
        })
      })
    ]);
  });

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

  it("uses Russian location hints to complete facility ticket proposals", () => {
    const draft = buildAiIntakeDraft({
      rawText: "сломалась ручка двери холодильника в холодильной комнате F-002",
      actor,
      language: "ru"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "ready_for_confirmation",
        missingFields: [],
        payload: expect.objectContaining({
          track: "facility",
          zone: "холодильной комнате F-002",
          description: "сломалась ручка двери холодильника в холодильной комнате F-002"
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

  it("treats plain inline transport problem text as ticket intake and resolves visible number 210", () => {
    const draft = buildAiIntakeDraft({
      rawText: "במלגזה 210 הגלגלים שבורים",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        fleet: [
          { id: "fleet-210", code: "210", type: "מלקטת", department: "נפחי" }
        ]
      }
    });

    expect(draft).toMatchObject({
      module: "transport",
      action: "draft_ticket"
    });
    expect(actions).toEqual([
      expect.objectContaining({
        type: "ticket.create",
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-210",
          asset: "210"
        })
      })
    ]);
  });

  it("keeps plain inline facility issues in the ticket flow and asks for a real location instead of guessing from problem words", () => {
    const draft = buildAiIntakeDraft({
      rawText: "המזגן במחסן לא עובד",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now: 2000 });

    expect(draft).toMatchObject({
      module: "facility",
      action: "draft_ticket"
    });
    expect(actions).toEqual([
      expect.objectContaining({
        type: "ticket.create",
        status: "needs_human_input",
        missingFields: expect.arrayContaining(["zone"]),
        payload: expect.objectContaining({
          track: "facility",
          zone: ""
        })
      })
    ]);
  });

  it("prefills a unique visible fleet unit and routes the last downtime detail to the normal ticket form", () => {
    const draft = buildAiIntakeDraft({
      rawText: "מלגזה 120823 תקועה באזור טעינה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        fleet: [
          { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" },
          { id: "fleet-178040", code: "178040", type: "מלגזת משקל נגדי", department: "הפצה" }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_form_review",
        requiresConfirmation: true,
        writesData: false,
        missingFields: ["downtimeType"],
        reviewMode: "ticket_form",
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          zone: "טעינה"
        })
      })
    ]);
  });

  it("prefills explicit critical downtime in complete transport ticket drafts", () => {
    const draft = buildAiIntakeDraft({
      rawText: "מלגזה 120823 מושבתת באזור טעינה ואין תחליף",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        fleet: [
          { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        missingFields: [],
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "fleet-120823",
          asset: "120823",
          downtimeType: "critical",
          priority: "high"
        })
      })
    ]);
  });

  it("prefills explicit replacement downtime without treating it as critical", () => {
    const draft = buildAiIntakeDraft({
      rawText: "מלגזה 120823 מושבתת אבל יש תחליף באזור טעינה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        fleet: [
          { id: "fleet-120823", code: "120823", type: "מלגזת היגש", department: "הפצה" }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "ready_for_confirmation",
        missingFields: [],
        payload: expect.objectContaining({
          forkliftId: "fleet-120823",
          downtimeType: "has_replacement",
          priority: "medium"
        })
      })
    ]);
  });

  it("does not guess a transport fleet unit when the mentioned code is ambiguous", () => {
    const draft = buildAiIntakeDraft({
      rawText: "מלגזה 120823 תקועה באזור טעינה",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        fleet: [
          { id: "fleet-120823-a", code: "120823", type: "מלגזת היגש", department: "הפצה" },
          { id: "fleet-120823-b", code: "120823", type: "מלגזת היגש", department: "הפצה" }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "create_ticket",
        type: "ticket.create",
        status: "needs_human_input",
        missingFields: expect.arrayContaining(["forkliftId", "downtimeType"]),
        payload: expect.objectContaining({
          track: "transport",
          forkliftId: "",
          asset: ""
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
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const expectedAt = new Date(2026, 6, 14, 9, 0).getTime();
    const draft = buildAiIntakeDraft({
      rawText: "פגישה מחר ב-09:00 לעבור על תקלות בטיחות",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    const actions = buildAiAssistActionProposals({ draft, user: actor, now });

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
          at: expectedAt,
          createdAt: now,
          updatedAt: now,
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

  it("proposes task due-date updates from explicit relative dates", () => {
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

  it("proposes task due-date updates from explicit calendar dates without guessing invalid dates", () => {
    const now = new Date(2026, 6, 13, 12, 34, 56, 789).getTime();
    const expectedDueAt = new Date(2026, 6, 15, 12, 34, 56, 789).getTime();
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את המשימה ל-15/07/2026",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now,
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
          patch: { dueAt: expectedDueAt }
        }
      })
    ]);

    const invalidDraft = buildAiIntakeDraft({
      rawText: "תעדכן את המשימה ל-32/07/2026",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft: invalidDraft,
      user: actor,
      now,
      context: {
        tasks: [{ id: "task-1", title: "בדיקת ספק", priority: "medium", status: "todo", dueAt: null }]
      }
    })).toEqual([]);
  });

  it("proposes task responsible updates only for a unique visible user", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את אחראי המשימה לדנה כהן",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        users: [
          { id: "u1", name: "Vadim", workerNo: "1" },
          { id: "u2", name: "דנה כהן", workerNo: "11032" }
        ],
        tasks: [{ id: "task-1", title: "בדיקת ספק", priority: "medium", status: "todo", responsibleIds: ["u1"] }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_task_task-1",
        type: "task.update",
        payload: {
          taskId: "task-1",
          taskTitle: "בדיקת ספק",
          current: { responsibleIds: ["u1"] },
          patch: { responsibleIds: ["u2"] },
          display: {
            responsibleIds: {
              before: ["Vadim"],
              after: ["דנה כהן"]
            }
          }
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        users: [
          { id: "u2", name: "דנה כהן", workerNo: "11032" },
          { id: "u3", name: "דנה כהן", workerNo: "11033" }
        ],
        tasks: [{ id: "task-1", title: "בדיקת ספק", responsibleIds: ["u1"] }]
      }
    })).toEqual([]);
  });

  it("proposes a constrained meeting time update only when a single visible meeting target is clear", () => {
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const currentAt = new Date(2026, 6, 13, 15, 0).getTime();
    const expectedAt = new Date(2026, 6, 14, 10, 30).getTime();
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הפגישה למחר ב-10:30",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now,
      context: {
        meetings: [{ id: "meeting-1", title: "ישיבת בטיחות", status: "planned", at: currentAt }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_meeting_meeting-1",
        type: "meeting.update",
        label: "עדכון פגישה",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          meetingId: "meeting-1",
          meetingTitle: "ישיבת בטיחות",
          current: { at: currentAt },
          patch: { at: expectedAt }
        },
        execute: {
          method: "POST",
          path: "/api/work",
          resource: "meetings",
          bodyField: "meeting"
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      now,
      context: {
        meetings: [
          { id: "meeting-1", title: "ישיבת בטיחות", status: "planned", at: currentAt },
          { id: "meeting-2", title: "ישיבה אחרת", status: "planned", at: currentAt }
        ]
      }
    })).toEqual([]);
  });

  it("proposes meeting creation and updates from explicit calendar dates with clock time", () => {
    const now = new Date(2026, 6, 13, 12, 34).getTime();
    const expectedAt = new Date(2026, 6, 16, 9, 15).getTime();
    const createDraft = buildAiIntakeDraft({
      rawText: "פגישה ב-16.07.26 בשעה 09:15 לעבור על תקלות בטיחות",
      actor,
      language: "he",
      source: "ui"
    }, 1000);

    expect(buildAiAssistActionProposals({ draft: createDraft, user: actor, now })).toEqual([
      expect.objectContaining({
        id: "create_meeting",
        type: "meeting.create",
        status: "ready_for_confirmation",
        payload: expect.objectContaining({ at: expectedAt })
      })
    ]);

    const updateDraft = buildAiIntakeDraft({
      rawText: "תעדכן את הפגישה ל-16/07/2026 בשעה 09:15",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft: updateDraft,
      user: actor,
      now,
      context: {
        meetings: [{ id: "meeting-1", title: "ישיבת בטיחות", status: "planned", at: now }]
      }
    })).toEqual([
      expect.objectContaining({
        id: "update_meeting_meeting-1",
        type: "meeting.update",
        payload: {
          meetingId: "meeting-1",
          meetingTitle: "ישיבת בטיחות",
          current: { at: now },
          patch: { at: expectedAt }
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

  it("proposes explicit ticket zone updates without guessing from free text", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה לאזור משרדים",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      now: 2000,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", priority: "medium", status: "new", zone: "קבלה" }]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { zone: "קבלה" },
          patch: { zone: "משרדים" }
        },
        execute: {
          method: "POST",
          path: "/api/tickets",
          bodyField: "ticket"
        }
      })
    ]);

    const unchangedDraft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה לאזור קבלה",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft: unchangedDraft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", zone: "קבלה" }]
      }
    })).toEqual([]);
  });

  it("proposes explicit transport unit updates only from a unique visible fleet code", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעדכן את הקריאה לכלי 120823",
      actor,
      language: "he"
    }, 1000);

    const actions = buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", track: "transport", forkliftId: "", asset: "" }],
        fleet: [
          { id: "fleet-120823", code: "120823", type: "מלגזת היגש" },
          { id: "fleet-178040", code: "178040", type: "מלגזת משקל נגדי" }
        ]
      }
    });

    expect(actions).toEqual([
      expect.objectContaining({
        id: "update_ticket_T-1",
        type: "ticket.update",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "תקלה במלגזה",
          current: { forkliftId: "", asset: "" },
          patch: { forkliftId: "fleet-120823", asset: "120823" }
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
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", track: "transport", forkliftId: "fleet-120823", asset: "120823" }],
        fleet: [{ id: "fleet-120823", code: "120823", type: "מלגזת היגש" }]
      }
    })).toEqual([]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", track: "transport", forkliftId: "", asset: "" }],
        fleet: [
          { id: "fleet-a", code: "120823", type: "מלגזת היגש" },
          { id: "fleet-b", code: "120823", type: "מלגזת היגש" }
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
        profile: { capabilities: { supplierRouting: true } },
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

  it("does not propose supplier routing without supplier management permission", () => {
    const draft = buildAiIntakeDraft({
      rawText: "תעביר את הקריאה לספק Toyota",
      actor: { id: "manager-1", role: "user", name: "Manager" },
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft,
      user: { id: "manager-1", role: "user", name: "Manager", permissions: { suppliers: "view" } },
      now: 2000,
      context: {
        profile: { capabilities: { supplierRouting: false, supplierDirectory: true } },
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", priority: "medium", status: "new", supplier: "" }],
        suppliers: [{ name: "Toyota", type: "transport", scopes: ["transport"] }]
      }
    })).toEqual([]);
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

  it("proposes explicit ticket close and cancel status updates for one visible ticket", () => {
    const closeDraft = buildAiIntakeDraft({
      rawText: "סגור את הקריאה, הטיפול הושלם",
      actor,
      language: "he"
    }, 1000);
    const cancelDraft = buildAiIntakeDraft({
      rawText: "בטל את הקריאה הזאת",
      actor,
      language: "he"
    }, 1000);

    expect(buildAiAssistActionProposals({
      draft: closeDraft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", status: "in_progress", waitingReason: "", waitBall: "" }]
      }
    })).toEqual([
      expect.objectContaining({
        type: "ticket.update",
        status: "ready_for_confirmation",
        requiresConfirmation: true,
        writesData: false,
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { status: "in_progress" },
          patch: { status: "done" }
        }
      })
    ]);

    expect(buildAiAssistActionProposals({
      draft: cancelDraft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "דליפת מים", status: "new" }]
      }
    })).toEqual([
      expect.objectContaining({
        payload: {
          ticketId: "T-1",
          ticketTitle: "דליפת מים",
          current: { status: "new" },
          patch: { status: "cancelled" }
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
        profile: { capabilities: { supplierRouting: true } },
        suppliers: [{ name: "Toyota" }, { name: "Toyota North" }]
      }
    })).toEqual([]);

    expect(buildAiAssistActionProposals({
      draft,
      user: actor,
      context: {
        tickets: [{ id: "T-1", subject: "תקלה במלגזה", supplier: "Toyota" }],
        profile: { capabilities: { supplierRouting: true } },
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
