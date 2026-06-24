import { describe, expect, it } from "vitest";
import { BACKUP_COLLECTIONS, BACKUP_COLLECTION_KEYS, BACKUP_VERSION, buildBackupPayload } from "../src/backupModel.js";

describe("backup model", () => {
  it("covers every business collection that must round-trip through backup/restore", () => {
    expect(BACKUP_COLLECTION_KEYS).toEqual([
      "users",
      "fleet",
      "tickets",
      "pm",
      "insp",
      "templates",
      "presence",
      "zones",
      "rounds",
      "complaints",
      "absences",
      "tasks",
      "meetings",
      "ppe",
      "ppeItems",
      "ppeNorms",
      "ppeReqs",
      "ppeOrders",
    ]);

    expect(BACKUP_COLLECTIONS).toEqual([
      { key: "users", prefix: "user:" },
      { key: "fleet", prefix: "fleet:" },
      { key: "tickets", prefix: "ticket:" },
      { key: "pm", prefix: "pm:" },
      { key: "insp", prefix: "insp:" },
      { key: "templates", prefix: "itpl:" },
      { key: "presence", prefix: "presence:" },
      { key: "zones", prefix: "czone:" },
      { key: "rounds", prefix: "cround:" },
      { key: "complaints", prefix: "ccomplaint:" },
      { key: "absences", prefix: "cabsence:" },
      { key: "tasks", prefix: "mtask:" },
      { key: "meetings", prefix: "mmeet:" },
      { key: "ppe", prefix: "ppe:" },
      { key: "ppeItems", prefix: "ppeitem:" },
      { key: "ppeNorms", prefix: "ppenorm:" },
      { key: "ppeReqs", prefix: "ppereq:" },
      { key: "ppeOrders", prefix: "ppeorder:" },
    ]);
  });

  it("builds a versioned payload with empty arrays for missing collections", () => {
    const payload = buildBackupPayload({
      exportedAt: 123,
      config: { departments: ["A"] },
      collections: {
        users: [{ id: "u1" }],
        tasks: [{ id: "t1" }],
        ppeReqs: [{ id: "r1" }],
      },
      photos: { "photo:ticket-1": "data:image/png;base64,abc" },
    });

    expect(payload).toMatchObject({
      __app: "maintenance-cmms",
      v: BACKUP_VERSION,
      exportedAt: 123,
      config: { departments: ["A"] },
      users: [{ id: "u1" }],
      tasks: [{ id: "t1" }],
      ppeReqs: [{ id: "r1" }],
      photos: { "photo:ticket-1": "data:image/png;base64,abc" },
    });
    expect(payload.meetings).toEqual([]);
    expect(payload.ppe).toEqual([]);
    expect(payload.ppeItems).toEqual([]);
    expect(payload.ppeNorms).toEqual([]);
    expect(payload.ppeOrders).toEqual([]);
  });
});
