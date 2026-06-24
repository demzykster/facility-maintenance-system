# Permissions Model

This document is the guardrail for user access settings. Before adding a new checkbox, role, screen access flag, or module permission, check this file first.

## Problem

The prototype currently mixes several permission styles:

- role-based access (`admin`, `user`, `tech`, `worker`, `cleaner`);
- one-off flags such as `fleetDocs` and `fleetTickets`;
- PPE-specific permission such as `perms.ppe`;
- UI text that treats "HR" as full PPE access, not as a separate role.

This creates duplicate settings. For example, a user card can show separate fleet/PPE toggles even though these should eventually be part of one permission model.

## Principle

Role answers:

```text
Who is this person in the company?
```

Permissions answer:

```text
What exactly can this person do in the system?
```

Keep roles as defaults, but store individual overrides in one permission structure.

## Permission Levels

Use these levels consistently:

```text
none     no access
view     can see
request  can create requests in their scope
manage   can create/update operational records in their scope
full     full module authority
```

Not every module must use every level. If a level does not make sense for a module, the UI should hide it.

## Modules

Suggested module keys:

```text
tickets
fleet
fleetDocs
drivers
ppe
suppliers
analytics
cleaning
users
workerAccess
settings
audit
```

## Current Migration Targets

These existing fields should eventually move into the unified `perms` model:

```text
fleetDocs       -> perms.fleetDocs
fleetTickets    -> perms.fleet or perms.tickets, depending on final wording
perms.ppe=full  -> perms.ppe
ppeFull UI      -> permissions editor, not a separate HR checkbox
```

Do not add another isolated checkbox for a new module if it can be represented as a module permission.

## HR / Employee Management

Do not create a separate HR role yet.

For now, "HR" should mean a manager/admin-like user with specific permissions, for example:

```text
ppe: full
users: view or manage
workerAccess: manage
```

This avoids mixing "clothing module access" with broader employee access. PPE, worker records, and worker login activation are related but separate permissions.

## Worker Login / Onboarding

Worker login should not require admins to invent and remember worker passwords/codes.

Preferred future flow:

- worker is created with worker number and profile data;
- system creates an activation state;
- manager/admin/authorized HR can copy an activation link;
- worker opens the link and creates a personal code with confirmation;
- old personal codes are never shown to managers;
- authorized users can reset access, generating a new activation link.

The worker active/inactive state should be handled by lifecycle actions such as "worker left" and restore-from-archive, not by a generic "active user" checkbox in the worker form.

## UI Direction

The user form should eventually show one permissions editor instead of separate scattered permission toggles.

Current implementation note:

- Permission levels, role defaults, legacy migration, and the user permission editor module list live in `src/permissionModel.js`.
- `src/ClaudeMaintenanceApp.jsx` imports that model instead of defining permission modules inline.
- UI gates should use `hasPermission`, `canView`, `canRequest`, `canManage`, or `canFull` from `src/permissionModel.js`, not ad hoc level comparisons.
- `tests/permissionsMigration.test.js`, `tests/permissionEditorModules.test.js`, and `tests/permissionCapabilities.test.js` cover the current migration bridge, editor module contract, and capability helpers.
- The user permission editor now includes `users` as a module separate from `workerAccess`, so HR-like access can be expressed without creating an HR role or another one-off checkbox.
- The `צוות ומשתמשים` screen is gated by `users`: `view` shows the team tree read-only, while `manage` enables creating, editing, archiving, and restoring users.
- Managers default to `ppe: request`, so they can submit clothing/PPE requests for their scope unless explicitly set to `ppe: none`.
- The permission editor also includes management modules `analytics`, `suppliers`, `settings`, and `audit`; screen gates should be added against these module keys instead of new one-off flags.

Possible grouping:

```text
Operations: tickets, fleet, drivers
Employees: users, workerAccess, ppe
Management: suppliers, analytics, settings, audit
Cleaning: cleaning
```

For each module, show only meaningful levels.

## Backend Note

In the current frontend demo, permissions are UI/business-logic checks only. In production, the same permission model must be enforced server-side with Auth/RLS/Audit.
