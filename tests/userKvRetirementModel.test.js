import { describe, expect, it } from "vitest";
import { planRetiredUserKvDeletion } from "../src/userKvRetirementModel.js";

describe("user KV retirement model", () => {
  it("deletes only when every legacy user is safely matched to app_users", () => {
    const plan = planRetiredUserKvDeletion({
      legacyRows: [
        { record_key: "user:manager-1", value: JSON.stringify({ id: "manager-1", email: "manager@example.com", role: "user" }) },
        { record_key: "user:worker-1", value: JSON.stringify({ id: "worker-1", workerNo: "2042", role: "worker" }) }
      ],
      appUsers: [
        { id: "app-manager", email: "manager@example.com" },
        { id: "app-worker", worker_no: "2042" }
      ]
    });

    expect(plan.ok).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.keys).toEqual(["user:manager-1", "user:worker-1"]);
  });

  it("blocks deletion when any legacy user is not matched", () => {
    const plan = planRetiredUserKvDeletion({
      legacyRows: [
        { record_key: "user:legacy-only", value: JSON.stringify({ id: "legacy-only", email: "legacy@example.com", role: "user" }) }
      ],
      appUsers: []
    });

    expect(plan.ok).toBe(false);
    expect(plan.blockers).toContain("legacy_only_users");
    expect(plan.keys).toEqual([]);
  });
});
