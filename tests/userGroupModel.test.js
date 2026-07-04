import { describe, expect, it } from "vitest";
import {
  assignmentCandidateIds,
  groupAudienceIds,
  groupContainsUser,
  normalizeUserGroup,
  normalizeUserGroupMemberships,
  userBelongsToGroup,
  userLeadsGroup,
  userObservesGroup,
  visibleGroupIdsForUser
} from "../src/userGroupModel.js";

describe("user group model", () => {
  it("normalizes organizational groups without turning them into roles", () => {
    const group = normalizeUserGroup({
      id: "safety-committee",
      name: "ועדת בטיחות",
      type: "committee",
      domain: "safety",
      leadIds: ["u1", "u1"],
      memberIds: ["u2", { id: "u3" }],
      observerIds: ["ops"],
      notifyIds: ["u4", ""],
      capabilities: { reviewFindings: true }
    });

    expect(group).toMatchObject({
      id: "safety-committee",
      name: "ועדת בטיחות",
      type: "committee",
      domain: "safety",
      active: true,
      leadIds: ["u1"],
      memberIds: ["u2", "u3"],
      observerIds: ["ops"],
      notifyIds: ["u4"],
      capabilities: { reviewFindings: true }
    });
  });

  it("lets one person have several memberships above their base role", () => {
    const user = {
      id: "manager-1",
      role: "user",
      userGroups: [
        { groupId: "safety-committee", role: "lead" },
        { groupId: "emergency-team", role: "member" },
        { groupId: "executive-observers", role: "observer" }
      ]
    };

    expect(normalizeUserGroupMemberships(user)).toEqual([
      { userId: "manager-1", groupId: "safety-committee", role: "lead" },
      { userId: "manager-1", groupId: "emergency-team", role: "member" },
      { userId: "manager-1", groupId: "executive-observers", role: "observer" }
    ]);
    expect(userLeadsGroup(user, "safety-committee")).toBe(true);
    expect(userBelongsToGroup(user, "emergency-team")).toBe(true);
    expect(userObservesGroup(user, "executive-observers")).toBe(true);
  });

  it("deduplicates mixed legacy membership fields and keeps strongest membership role", () => {
    const user = {
      id: "u1",
      groups: ["quality-team", { id: "safety-trustees", role: "member" }],
      groupIds: ["quality-team"],
      userGroups: [{ groupId: "safety-trustees", role: "lead" }]
    };

    expect(normalizeUserGroupMemberships(user)).toEqual(expect.arrayContaining([
      { userId: "u1", groupId: "quality-team", role: "member" },
      { userId: "u1", groupId: "safety-trustees", role: "lead" }
    ]));
    expect(normalizeUserGroupMemberships(user)).toHaveLength(2);
  });

  it("resolves group audience for visibility and notifications", () => {
    const groups = [
      {
        id: "quality-team",
        memberIds: ["qa-1", "qa-2"],
        leadIds: ["qa-lead"],
        observerIds: ["coo"],
        notifyIds: ["qa-mailbox"]
      },
      {
        id: "inactive-team",
        active: false,
        memberIds: ["hidden"]
      }
    ];

    expect(groupAudienceIds(groups, ["quality-team", "inactive-team"])).toEqual(["qa-1", "qa-2", "qa-lead", "qa-mailbox"]);
    expect(groupAudienceIds(groups, ["quality-team"], { includeObservers: true })).toEqual(["qa-1", "qa-2", "qa-lead", "coo", "qa-mailbox"]);
  });

  it("uses members and leads, not observers, as assignment candidates", () => {
    const groups = [{
      id: "department-managers",
      memberIds: ["manager-1"],
      leadIds: ["ops-lead"],
      observerIds: ["ceo"],
      notifyIds: ["ops-mailbox"]
    }];

    expect(assignmentCandidateIds(groups, ["department-managers"])).toEqual(["manager-1", "ops-lead"]);
  });

  it("keeps inactive groups out of membership checks from group records", () => {
    const inactive = { id: "emergency-team", active: false, memberIds: ["u1"], leadIds: ["u2"], observerIds: ["u3"] };

    expect(groupContainsUser(inactive, "u1")).toBe(false);
    expect(groupContainsUser(inactive, "u2")).toBe(false);
    expect(groupContainsUser(inactive, "u3", { includeObservers: true })).toBe(false);
  });

  it("lists visible groups from explicit memberships and group records", () => {
    const user = {
      id: "u1",
      role: "worker",
      userGroups: [{ groupId: "safety-trustees", role: "member" }]
    };
    const groups = [
      { id: "safety-trustees", memberIds: [] },
      { id: "quality-team", memberIds: ["u1"] },
      { id: "leadership", observerIds: ["u1"] },
      { id: "inactive", active: false, memberIds: ["u1"] }
    ];

    expect(visibleGroupIdsForUser(user, groups)).toEqual(["safety-trustees", "quality-team", "leadership"]);
    expect(visibleGroupIdsForUser(user, groups, { includeObservers: false })).toEqual(["safety-trustees", "quality-team"]);
  });
});
