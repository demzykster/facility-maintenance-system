const textId = (value) => String(value || "").trim();

const matchesZone = (record, zoneId) => textId(record?.zoneId) === zoneId;

export function cleaningZoneDeleteBlockers(zoneId, { rounds = [], complaints = [], users = [] } = {}) {
  const id = textId(zoneId);
  if (!id) return { rounds: [], complaints: [], managers: [] };

  return {
    rounds: (rounds || []).filter((round) => matchesZone(round, id)),
    complaints: (complaints || []).filter((complaint) => matchesZone(complaint, id)),
    managers: (users || []).filter((user) => Array.isArray(user?.mgrZones) && user.mgrZones.map(textId).includes(id))
  };
}

export function cleaningZoneBlockerCount(blockers = {}) {
  const safeBlockers = blockers || {};
  return (safeBlockers.rounds || []).length + (safeBlockers.complaints || []).length + (safeBlockers.managers || []).length;
}

export function cleaningZoneDeletePlan(zoneId, data = {}) {
  const id = textId(zoneId);
  const blockers = cleaningZoneDeleteBlockers(id, data);
  if (!id) return {
    zoneId: "",
    deleteKeys: [],
    updatedManagers: [],
    summary: { rounds: 0, complaints: 0, managers: 0 }
  };

  return {
    zoneId: id,
    deleteKeys: [
      ...(blockers.rounds || []).map((round) => `cround:${round.id}`),
      ...(blockers.complaints || []).map((complaint) => `ccomplaint:${complaint.id}`),
      `czone:${id}`
    ],
    updatedManagers: (blockers.managers || []).map((manager) => ({
      ...manager,
      mgrZones: (manager.mgrZones || []).filter((item) => textId(item) !== id)
    })),
    summary: {
      rounds: (blockers.rounds || []).length,
      complaints: (blockers.complaints || []).length,
      managers: (blockers.managers || []).length
    }
  };
}
