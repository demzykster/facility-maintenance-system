const cleanString = (value) => String(value == null ? "" : value).trim();

const DEFAULT_GROUP_TYPE = "custom";
const DEFAULT_GROUP_DOMAIN = "general";

const uniqueStrings = (values = []) => [...new Set(values.map(cleanString).filter(Boolean))];

const compactObject = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const listFrom = (...values) => values.flatMap((value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
});

const idsFrom = (...values) => uniqueStrings(listFrom(...values).map((value) => {
  if (value && typeof value === "object") return value.id || value.userId || value.value || "";
  return value;
}));

const groupIdFrom = (membership) => {
  if (!membership) return "";
  if (typeof membership === "string") return membership;
  return membership.groupId || membership.id || membership.value || "";
};

const membershipRoleFrom = (membership) => {
  if (!membership || typeof membership !== "object") return "member";
  if (membership.lead || membership.isLead || membership.role === "lead" || membership.kind === "lead") return "lead";
  if (membership.observer || membership.role === "observer" || membership.kind === "observer") return "observer";
  return "member";
};

export const normalizeUserGroup = (group = {}) => {
  const name = cleanString(group.name || group.label || group.title);
  const id = cleanString(group.id || group.groupId || group.key || name);

  return compactObject({
    id,
    name,
    type: cleanString(group.type) || DEFAULT_GROUP_TYPE,
    domain: cleanString(group.domain || group.module) || DEFAULT_GROUP_DOMAIN,
    active: group.active !== false,
    leadIds: idsFrom(group.leadIds, group.leaderIds, group.coordinatorIds, group.leads, group.leaders, group.coordinators),
    memberIds: idsFrom(group.memberIds, group.members, group.userIds, group.users),
    observerIds: idsFrom(group.observerIds, group.observers),
    notifyIds: idsFrom(group.notifyIds, group.notificationUserIds, group.notifications),
    capabilities: group.capabilities && typeof group.capabilities === "object" && !Array.isArray(group.capabilities)
      ? { ...group.capabilities }
      : {},
    notes: cleanString(group.notes || group.description) || undefined
  });
};

export const normalizeUserGroupMemberships = (user = {}) => {
  const userId = cleanString(user.id || user.userId);
  const directMemberships = listFrom(user.userGroups, user.groups, user.groupIds);
  const normalized = directMemberships
    .map((membership) => ({
      userId,
      groupId: cleanString(groupIdFrom(membership)),
      role: membershipRoleFrom(membership)
    }))
    .filter((membership) => membership.groupId);

  const byKey = new Map();
  const rank = { member: 1, observer: 2, lead: 3 };

  for (const membership of normalized) {
    const existing = byKey.get(membership.groupId);
    if (!existing || rank[membership.role] > rank[existing.role]) byKey.set(membership.groupId, membership);
  }

  return [...byKey.values()];
};

export const userBelongsToGroup = (user = {}, groupId) =>
  normalizeUserGroupMemberships(user).some((membership) => membership.groupId === cleanString(groupId));

export const userLeadsGroup = (user = {}, groupId) =>
  normalizeUserGroupMemberships(user).some((membership) => membership.groupId === cleanString(groupId) && membership.role === "lead");

export const userObservesGroup = (user = {}, groupId) =>
  normalizeUserGroupMemberships(user).some((membership) => membership.groupId === cleanString(groupId) && membership.role === "observer");

export const groupContainsUser = (group = {}, userId, options = {}) => {
  const normalized = normalizeUserGroup(group);
  const id = cleanString(userId);
  if (!normalized.active || !id) return false;
  if (normalized.memberIds.includes(id)) return true;
  if (normalized.leadIds.includes(id)) return true;
  return options.includeObservers === true && normalized.observerIds.includes(id);
};

export const groupAudienceIds = (groups = [], groupIds = [], options = {}) => {
  const ids = new Set(uniqueStrings(groupIds));
  const includeMembers = options.includeMembers !== false;
  const includeLeads = options.includeLeads !== false;
  const includeObservers = options.includeObservers === true;
  const includeNotify = options.includeNotify !== false;

  return uniqueStrings(groups
    .map(normalizeUserGroup)
    .filter((group) => group.active && ids.has(group.id))
    .flatMap((group) => [
      ...(includeMembers ? group.memberIds : []),
      ...(includeLeads ? group.leadIds : []),
      ...(includeObservers ? group.observerIds : []),
      ...(includeNotify ? group.notifyIds : [])
    ]));
};

export const assignmentCandidateIds = (groups = [], groupIds = []) =>
  groupAudienceIds(groups, groupIds, { includeMembers: true, includeLeads: true, includeObservers: false, includeNotify: false });

export const visibleGroupIdsForUser = (user = {}, groups = [], options = {}) => {
  const id = cleanString(user.id || user.userId);
  const explicit = new Set(normalizeUserGroupMemberships(user).map((membership) => membership.groupId));
  return groups
    .map(normalizeUserGroup)
    .filter((group) => group.active)
    .filter((group) => explicit.has(group.id) || groupContainsUser(group, id, { includeObservers: options.includeObservers !== false }))
    .map((group) => group.id);
};
