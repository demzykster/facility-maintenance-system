export const STARTUP_KV_PREFIXES = Object.freeze({
  tickets: "ticket:",
  pm: "pm:",
  fleet: "fleet:",
  presence: "presence:",
  users: "user:",
  cleaningZones: "czone:",
  cleaningRounds: "cround:",
  cleaningComplaints: "ccomplaint:",
  workerAbsences: "cabsence:",
  locations: "location:",
  workTasks: "mtask:",
  workMeetings: "mmeet:",
  ppeMovements: "ppe:",
  ppeItems: "ppeitem:",
  ppeNorms: "ppenorm:",
  ppeRequests: "ppereq:",
  ppeOrders: "ppeorder:",
  appIssues: "appIssue:"
});

const STARTUP_PREFIX_AUTHORITY_KEYS = Object.freeze([
  ["tickets", "tickets"],
  ["pm", "pm"],
  ["fleet", "fleet"],
  ["presence", "presence"],
  ["users", "users"],
  ["cleaningZones", "cleaningZones"],
  ["cleaningRounds", "cleaningRounds"],
  ["cleaningComplaints", "cleaningComplaints"],
  ["workerAbsences", "workerAbsences"],
  ["locations", "settingsRecords"],
  ["workTasks", "work"],
  ["workMeetings", "work"],
  ["ppeMovements", "ppe"],
  ["ppeItems", "ppe"],
  ["ppeNorms", "ppe"],
  ["ppeRequests", "ppe"],
  ["ppeOrders", "ppe"],
  ["appIssues", "settingsRecords"]
]);

export function startupKvPrefixesForAuthorities(authorities = {}) {
  return STARTUP_PREFIX_AUTHORITY_KEYS
    .filter(([, authorityKey]) => authorities[authorityKey] !== true)
    .map(([prefixKey]) => STARTUP_KV_PREFIXES[prefixKey]);
}
