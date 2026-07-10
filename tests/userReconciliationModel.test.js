import { describe, expect, it } from "vitest";
import { reconcileLegacyUsers } from "../src/userReconciliationModel.js";

describe("user reconciliation model", () => {
  it("classifies matched, ambiguous, legacy-only, and malformed user records", () => {
    const report = reconcileLegacyUsers({
      legacyRows: [
        { record_key: "user:legacy-auth", value: JSON.stringify({ id: "legacy-auth", authUserId: "auth-1", name: "Owner", role: "user" }) },
        { record_key: "user:legacy-worker", value: JSON.stringify({ id: "legacy-worker", workerNo: "2042", phone: "050-111-2222", name: "Worker", role: "worker" }) },
        { record_key: "user:legacy-only", value: JSON.stringify({ id: "legacy-only", email: "legacy@example.com", name: "Legacy", role: "user" }) },
        { record_key: "user:ambiguous", value: JSON.stringify({ id: "ambiguous", email: "same@example.com", name: "Ambiguous", role: "user" }) },
        { record_key: "user:bad", value: "{bad json" }
      ],
      appUsers: [
        { id: "app-1", auth_user_id: "auth-1", name: "Owner" },
        { id: "app-2", worker_no: "2042", phone: "0501112222", name: "Worker" },
        { id: "app-3", email: "same@example.com", name: "Same A" },
        { id: "app-4", email: "same@example.com", name: "Same B" }
      ]
    });

    expect(report.counts).toEqual({
      legacyUsers: 4,
      appUsers: 4,
      matched: 2,
      ambiguous: 1,
      legacyOnly: 1,
      parseErrors: 1
    });
    expect(report.matched).toEqual([
      expect.objectContaining({ key: "user:legacy-auth", appUserId: "app-1", reasons: ["authUserId"] }),
      expect.objectContaining({ key: "user:legacy-worker", appUserId: "app-2", reasons: ["workerNo", "phone"] })
    ]);
    expect(report.ambiguous[0]).toMatchObject({
      key: "user:ambiguous",
      candidates: [
        { appUserId: "app-3", reasons: ["email"] },
        { appUserId: "app-4", reasons: ["email"] }
      ]
    });
    expect(report.legacyOnly[0]).toMatchObject({ key: "user:legacy-only", hasEmail: true });
    expect(report.parseErrors).toEqual([{ key: "user:bad" }]);
  });
});
