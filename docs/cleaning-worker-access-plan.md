# Cleaning Worker Access Plan

This document records the owner-approved direction for replacing `cleaner` as a long-term system role.

## Decision

Cleaning workers should be modeled as ordinary workers with a permanent cleaning capability, not as a separate core role.

Target user shape:

```js
{
  role: "worker",
  employmentType: "direct" | "contractor",
  contractorName: "",
  cleaningAccess: {
    canPerformRounds: true,
    canReceiveComplaints: true,
    canCloseComplaints: true,
    canManageCleaningZones: false,
    canViewCleaningReports: false
  }
}
```

The product meaning is:

- a cleaner is a worker whose regular job function is cleaning;
- login should be the worker PIN / worker-number flow;
- worker features remain available to cleaning workers;
- cleaning permissions are capabilities, not a separate person type.

## Access Levels

Default cleaning worker access:

- perform cleaning rounds;
- receive complaints for assigned/covered zones;
- close/respond to cleaning complaints.

Management access is separate:

- manage cleaning zones, windows, checklists, assignments;
- view cleaning reports/analytics.

Management access should come from module permissions or group/capability configuration, not from being a cleaning worker.

## Contractor Workers

Contractor is not a role.

Use:

```js
employmentType: "contractor"
contractorName: "..."
```

This keeps the same worker login and cleaning UX while supporting reporting by contractor, complaint volume, overdue rounds, and quality trends.

## Current Data Assumption

As of 2026-07-04, the owner explicitly confirmed that current users/history/working app data are not valuable for migration.

Architectural cleanup does not need to preserve current local/staging user or history records for business continuity.

Boundary:

- this does not authorize silent destructive Supabase cleanup;
- destructive data cleanup still requires an explicit owner request for that operation;
- it does mean model decisions should not be blocked by preserving current `cleaner` history.

## Implementation Order

Do not remove `cleaner` directly.

Use a compatibility path:

1. Add a pure model/helper layer:
   - `isWorkerLike(user)`
   - `hasCleaningAccess(user)`
   - `canPerformCleaning(user)`
   - `canReceiveCleaningComplaints(user)`
   - `canCloseCleaningComplaints(user)`
   - `canManageCleaningZones(user)`
   - `canViewCleaningReports(user)`
2. Treat legacy `role === "cleaner"` as cleaning access during transition.
3. Replace code checks such as `role === "cleaner"` with helpers.
4. Update server-side permission checks so `worker + cleaningAccess` can write the needed cleaning records.
5. Stop creating new users with role `cleaner`; create workers with cleaning access instead.
6. Only then perform explicit cleanup/reset of old users/history if requested.

## Known Code Touchpoints

The current app still treats `cleaner` as a real role in several places:

- server session/admin profile role validation;
- Supabase app user role list;
- KV write permissions for `cround:` and `ccomplaint:`;
- notification access for cleaning notifications;
- first-login/PIN role helpers;
- user/profile forms and role labels;
- cleaning shell routing and role-specific UI labels;
- tests and release docs.

Cleaning access is an operational capability that already affects login, permissions, writes, and notifications.
