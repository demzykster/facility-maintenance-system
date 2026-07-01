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
  return (blockers.rounds || []).length + (blockers.complaints || []).length + (blockers.managers || []).length;
}

export function canDeleteCleaningZone(zoneId, data) {
  return cleaningZoneBlockerCount(cleaningZoneDeleteBlockers(zoneId, data)) === 0;
}
