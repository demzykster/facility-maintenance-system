# CMMS Release Checklist

This is the closure checklist for the current stabilization phase. It replaces broad repeating labels with packages that can actually be closed.

## How To Use

- Work top to bottom unless the owner reports a critical bug.
- Each package can take several small PRs, but the package is closed only when its `Done means` list is true.
- Do not keep a package open after the acceptance criteria are satisfied. Move leftovers into a new explicit package.
- Keep implementation PRs atomic; update this checklist only when a package status or acceptance criterion changes.

## Current Release Packages

### R9 — Production Backend Foundation

Status: done for the current staging/pilot foundation.

Why it matters:
- The project should move from browser-local demo storage to a real production foundation without breaking the working CMMS flows.

Done means:
- The frontend data-access boundary is extracted from `src/ClaudeMaintenanceApp.jsx`.
- The current business collections are mapped to the current production storage boundary.
- Production mode disables demo seed data and built-in demo identities.
- Production starts empty of current fake demo/local data; first-admin bootstrap is the only required initial record.
- Production storage provider mode and API storage contract are defined without replacing the current demo storage path.
- A release configuration gate blocks production mode when it still points at local/browser storage.
- Auth, permissions/RLS, files/photos, AI calls, audit, and backup/restore risks are explicitly tracked before final normalized production work.
- The monolith extraction path is adapter/model-first, not a whole-file rewrite.

Closed notes:
- Owner opened the production backend/auth phase after R8.
- `docs/production-hardening-plan.md` is the active risk/order document.
- `src/dataCollections.js` is the first shared map from current backup/storage collections to production tables.
- `src/seedPolicyModel.js` and `docs/production-seed-policy.md` define the production empty-start and first-admin bootstrap boundary.
- Current demo/local records are not a migration source; imports are only for real owner-provided data.
- Before a real fleet workbook is loaded into the empty system, fleet Excel import must handle unknown vehicle models/types by previewing proposed catalog additions instead of leaving imported units with unconfigured SLA/document/PM rules.
- `src/storageProviderModel.js`, `src/apiStorageAdapter.js`, and `docs/production-storage-provider.md` define the backend storage path.
- `/api/kv` route skeleton exists but remains closed until server auth and a durable backend driver are configured.
- `npm run release:check` validates the current production storage-provider boundary.
- `docs/production-platform-decision.md` selects Vercel frontend + Supabase Postgres/Auth/RLS/Storage as the target production platform.
- `docs/production-bootstrap.md` and `/api/bootstrap/admin` define the server-only first-admin bootstrap contract for Supabase Auth plus `public.app_users`.
- `supabase/migrations/20260627173000_app_users_permissions.sql` defines the first `public.app_users` profile/RLS layer linked to Supabase Auth.
- `docs/supabase-session-adapter.md` and `/api/session/me` define the first server-side Supabase Auth + app profile session lookup.
- `src/productionLoginAdapter.js` connects production login to Supabase Auth and `/api/session/me` while leaving demo/test login unchanged.
- Supabase KV compatibility is the accepted staging/pilot bridge, not the final CMMS source of truth.
- Production file metadata, audit events, first-admin bootstrap, backup/restore drill, and staging gates are documented in the production docs.
- `src/productionReadinessModel.js` names the current state as `staging_pilot` when production config, Supabase schema, staging gate, and backup/restore drill are verified.
- Final production still requires moving beyond the accepted KV bridge into normalized business tables and broader server-side business permissions. That is tracked as R10, not as an unclosed R9 tail.

### R10 — Final Production Data Core

Status: started.

Why it matters:
- The current staging/pilot foundation is usable, but the accepted Supabase KV bridge is still a launch compromise.
- Final production should enforce business data shape and permissions at the database/server-operation layer, not only through frontend workflows plus a generic KV compatibility layer.

Done means:
- Core business records move from the compatibility KV bridge into normalized Supabase tables in a deliberate order.
- Server-side business operations enforce the same permissions as the UI for the moved flows.
- RLS/policies and audit coverage are verified for the moved tables.
- File ownership metadata links to normalized business records where those records exist.
- The production readiness model can report `final_production` without `normalized_business_tables_not_complete` or `server_side_business_permissions_not_complete`.
- The old KV bridge remains only for explicitly unmoved legacy data or is retired.

Current notes:
- First server-authority slice: the KV bridge now applies server-side read permissions for sensitive `user:` and `appIssue:` records, including direct reads, value-list reads, and key-only lists.
- Ordinary workers can read their own `user:` record but not the full user directory; managers/admins with user permissions can still read the directory with login secrets redacted where appropriate.
- `appIssue:` reports remain writable by working roles but readable only by admin/settings-management sessions.
- First normalized business-table slice: `public.tickets` exists as the target table for moving tickets off the KV bridge, with RLS for admins, ticket managers, assignees, and reporters.
- The staging schema gate now expects `public.tickets` for new Supabase staging/pilot projects.
- First normalized server-operation slice: `POST /api/tickets` can upsert tickets into `public.tickets` after Supabase/CMMS session validation and existing ticket write-permission checks.
- Pilot bridge slice: production/API-mode ticket saves keep the existing `ticket:*` KV record authoritative, then shadow-write the same ticket into `/api/tickets` so the normalized table fills without risking the live workflow.
- This reduces KV bridge exposure but does not complete R10; normalized business tables and broader server-side business permissions are still required.

### R3 — Notifications End-To-End

Status: done in PRs #180-#188.

Why it matters:
- Notifications should be an action map, not just a noisy inbox.

Done means:
- All important processes emit a notification for the correct role: tickets, SLA, parts/waiting, approvals, fleet docs, driver requests, PPE, cleaning, tasks/meetings, technician shift exceptions.
- Each notification either opens the exact item or a clearly filtered module.
- Global notification type settings and personal notification-panel filtering are both understandable.
- Duplicate/noisy notification patterns are either removed or intentionally grouped.

Closed notes:
- The notification matrix now covers the important role/process pairs.
- Critical routes open exact tickets, exact fleet cards, or clearly focused module tabs.
- Global notification toggles and personal notification-panel filters are available.
- Optional polish: exact PPE record focus when aggregate PPE notifications represent a single request/order/item.

### R4 — Permissions And Role Reality Check

Status: done in PRs #190-#196.

Why it matters:
- A CMMS with wrong access is dangerous even if the UI looks correct.

Done means:
- Admin, manager, technician, worker, and legacy cleaner each have a verified path to their expected modules during transition.
- Users with view-only permissions cannot edit.
- Users with manage permissions can reach the relevant controls without needing unrelated admin access.
- Worker login setup/reset remains gated by `workerAccess:manage`.
- Any role-specific smoke-check notes are captured in the related PR.

Closed notes:
- Manager/user routes now respect `users`, `audit`, `suppliers`, `analytics`, `settings`, and PPE management permissions.
- View/manage split was checked for the newly exposed routes: suppliers edit controls still require `suppliers:manage`, analytics damage fields are read-only in manager/user route, sensitive settings actions still require `settings:full`.
- Worker login setup/reset remains gated by `workerAccess:manage`.
- Role-smoke passed for admin, manager, technician, and worker; legacy cleaner shell renders cleanly and shows the empty-zone state when current local data has no assigned cleaner. Cleaning workers should use `worker` plus cleaning access/capabilities.

### R5 — Screen Audit And Visual Noise

Status: done in PRs #200-#257 plus final closure pass.

Why it matters:
- The system should feel like a dispatcher/control tool, not a pile of cards and duplicated controls.

Done means:
- The following screens have each had one focused audit pass: `קריאות`, `אנליטיקה`, `ביגוד עובדים`, `הגדרות`, `צוות ומשתמשים`, `כלי שינוע`, `בקרת ניקיון`.
- Each pass checks visual hierarchy, duplicate controls, unclear icons, Hebrew grammar, misleading labels, and dead/uninformative elements.
- Findings are fixed or deliberately deferred with a reason.

Closed notes:
- `קריאות`: search labeling, duplicate-review behavior, lifecycle/SLA display, drill-down reset, and ticket action labels were stabilized.
- `אנליטיקה`: drill-down paths, lifecycle/waiting metrics, export coverage, and visible wording were stabilized.
- `ביגוד עובדים`: empty order states, order-line labels, net-deficit suggestions, catalog/settings labels, and movement search were stabilized.
- `הגדרות`: duplicate module settings were moved to their module homes; waiting reasons, downtime levels, notifications, demo/backup copy, and delete actions were clarified.
- `צוות ומשתמשים`: permissions UI, read-only cards, group toggles, worker first-login setup flow, duplicate login warning, departments, and worker shifts were stabilized.
- `כלי שינוע`: fleet search, driver coverage search, driver request labels, warning dismissal, vehicle-type settings, and PM/detail edit labels were stabilized.
- `בקרת ניקיון`: zone setup, delete actions, report/spec actions, cleaner/manager/admin paths, and notification/report labels were stabilized.
- Final browser pass over all seven R5 screens found no visible unlabeled controls. Remaining broad redesign ideas should be tracked as explicit new packages, not as R5 leftovers.

### R6 — Worker Onboarding Polish

Status: done.

Why it matters:
- Worker login setup should be obvious for the person creating/resetting access.

Done means:
- New workers/users are saved without generated passwords, PINs, or links.
- First login by email or worker number opens the personal password/PIN creation form.
- Resetting access does not create a link; it clears the existing secret so the user sets a new one on next login.

Closed notes:
- The old activation-link model was replaced after owner review on 2026-07-01.
- The user-facing flow is now `identifier -> continue -> create password/PIN -> save and enter`.
- Reset remains permissioned by `workerAccess:manage`.

### R7 — Pre-Production Guardrails

Status: done.

Why it matters:
- Before treating the demo as close to production, we need to name what is still demo-only.

Done means:
- Known localStorage/demo limitations are documented in one short place.
- Backup/restore is verified after the latest collection changes.
- Vercel demo status is understood.
- Supabase/Auth/RLS/database was out of scope for this package at the time; the owner opened the Supabase-backed staging/auth phase after this package.

Closed notes:
- `docs/pre-production-readiness.md` now names Vercel as demo/staging, not production.
- The note documents current `localStorage` limits, demo-only login/activation/permission boundaries, and sensitive JSON backup handling.
- Backup/restore coverage was verified through `BACKUP_COLLECTIONS` and the backup model tests.
- Further Supabase/Auth/RLS/database expansion now requires explicit scoped work; Railway and broad modular split remain out of scope.

## Closed Release Packages

- Drill-down and filter reset: closed in PRs #177-#178.
  - Dashboard and Analytics drill-downs now show a visible source banner.
  - Banner clear removes all drill-down-applied ticket filters in one click.
  - Returning to Tickets through navigation resets hidden drill-down state unless the user intentionally applies a filter again.
  - Dashboard KPI labels were made specific where possible.
- SLA and lifecycle trust: closed in PRs #156-#175.
  - Dashboard, Analytics, ticket detail, exports, visible SLA badges, SLA bar, overdue drill-downs, ticket sorting, technician SLA count, and admin SLA notifications now use lifecycle helpers where historical waiting/stage timing matters.
  - Remaining direct `statusMs`, `waitingReason`, and `pauseSla` references are source data, lifecycle normalization, settings, transition bookkeeping, or fallback logic rather than visible stale SLA KPIs.
- Settings information architecture: task statuses, vehicle types, zones, departments, worker shifts, and empty registries were moved/cleaned in earlier PRs.
- Task Excel import duplicate matching: closed in PR #168.
- Notification default coverage and global type toggles: closed in PRs #169 and #170.
