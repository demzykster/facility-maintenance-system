import { reconcileLegacyUsers } from "./userReconciliationModel.js";

export function planRetiredUserKvDeletion({ legacyRows = [], appUsers = [] } = {}) {
  const report = reconcileLegacyUsers({ legacyRows, appUsers });
  const blockers = [];
  if (report.parseErrors.length) blockers.push("parse_errors");
  if (report.ambiguous.length) blockers.push("ambiguous_matches");
  if (report.legacyOnly.length) blockers.push("legacy_only_users");
  if (report.matched.length !== report.counts.legacyUsers) blockers.push("unmatched_legacy_users");
  return {
    ok: blockers.length === 0,
    blockers,
    report,
    keys: blockers.length === 0 ? report.matched.map((item) => item.key).filter(Boolean) : []
  };
}
