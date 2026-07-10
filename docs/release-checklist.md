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
- Live staging/pilot gate passed on 2026-07-10 against the Vercel production alias and linked Supabase staging project at commit `cb1f9b4`: env shape, schema/bucket, live commit, bootstrap-closed state, admin session, KV bridge, settings persistence, normalized tickets/fleet/PM API smokes, fleet UI/API/Supabase parity, AI intake smoke, system-error smoke, and desktop/mobile UI smoke.
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
- Pilot bridge slice: production/API-mode ticket saves keep the existing `ticket:*` KV record authoritative, then shadow-write the same ticket into `/api/tickets` so the normalized table fills without risking the live workflow. Ticket deletes also shadow-delete the normalized row to avoid stale pilot data.
- Normalized read slice: `/api/tickets` supports list and detail reads from `public.tickets`, and detail reads can include active `file_metadata` rows linked to the ticket.
- Staging reconciliation slice: `staging:tickets:reconcile` compares shared KV `ticket:*` records to `public.tickets`, backfills missing/drifted rows through `/api/tickets`, and fails the staging gate if the normalized table still disagrees with the KV authority.
- Ticket file ownership slice: the tickets API can expose active file metadata for a normalized ticket, and the staging tickets API smoke creates a temporary ticket, uploads a file with `ownerType=ticket`, verifies it through `/api/tickets?id=...&includeFiles=1`, then deletes the file and ticket.
- Ticket authority slice: in production/API mode, the app reads tickets from `/api/tickets`, writes/deletes through the normalized tickets API first, and no longer creates new `ticket:*` KV mirrors. Staging retired the matched ticket KV mirror after guarded dry-run proof. Demo/local mode still uses the existing KV path.
- Ticket cleanup slice: normalized ticket deletion also cleans ticket-owned Supabase Storage objects and marks active `file_metadata` rows deleted by owner, so deleting a ticket does not leave active file attachments behind.
- Fleet authority slice: `public.fleet_units` and `/api/fleet` are live. In production/API mode, fleet reads, saves, imports, batch saves, and deletes use the normalized API first, while `fleet:*` KV is only a compatibility mirror. The staging gate reconciles `fleet:*` to `public.fleet_units` and runs a controlled `/api/fleet` smoke.
- Periodic-maintenance authority slice: `public.periodic_maintenance` and `/api/pm` are live. In production/API mode, PM reads, saves, batch saves, and deletes use the normalized API first, while `pm:*` KV is only a compatibility mirror. The staging gate reconciles `pm:*` to `public.periodic_maintenance` and runs a controlled `/api/pm` smoke.
- Cleaning zones authority slice: `public.cleaning_zones` is live through `/api/cleaning/records?resource=zones`. In production/API mode, cleaning zone reads, saves, and deletes use the normalized API first and no longer create new `czone:*` KV mirrors. Public QR zone listing plus public complaint zone lookup read normalized cleaning zones before falling back to legacy `czone:*` KV when present. The staging gate reconciles protected `czone:*` KV records into `public.cleaning_zones` and runs a controlled cleaning zones smoke if old mirrors are present.
- Cleaning rounds authority slice: `public.cleaning_rounds` is live through `/api/cleaning/records?resource=rounds`. In production/API mode, cleaning round reads and saves use the normalized API first and no longer create new `cround:*` KV mirrors. The staging gate reconciles protected `cround:*` KV records into `public.cleaning_rounds` and runs a controlled cleaning rounds smoke if old mirrors are present.
- Cleaning records route-budget slice: cleaning zones, rounds, complaints, and worker absences are consolidated onto `/api/cleaning/records`, keeping the Vercel API route budget below the cap before later R10 domains add routes.
- Public complaints authority slice: `/api/public/complaints` keeps the existing public URL, reads normalized cleaning zones before `czone:*` fallback, and writes `public.cleaning_complaints` without creating a new `ccomplaint:*` KV mirror when the normalized complaints driver is configured.
- PPE authority slice: `public.ppe_items`, `public.ppe_norms`, `public.ppe_movements`, `public.ppe_requests`, and `public.ppe_orders` are live through one `/api/ppe` route. In production/API mode, PPE reads, saves, requests, catalog/norm changes, movements, and orders use the normalized API first and no longer create new `ppe:*`, `ppeitem:*`, `ppenorm:*`, `ppereq:*`, or `ppeorder:*` KV mirrors. Staging retired all matched PPE KV mirrors after guarded dry-run proof (`ppeitem:` 1, `ppenorm:` 1, `ppereq:` 1). The staging gate still reconciles PPE KV records into the normalized PPE tables and runs a controlled `/api/ppe` smoke if any legacy PPE mirrors are present.
- Work-records authority slice: `public.maintenance_tasks` and `public.maintenance_meetings` are live through one `/api/work` route. In production/API mode, task and meeting reads/saves/deletes use the normalized API first, while `mtask:*` and `mmeet:*` KV records remain compatibility mirrors. The staging gate reconciles work-record KV records into the normalized tables and runs a controlled `/api/work` smoke.
- Public route-budget slice: `/api/public/complaints` and `/api/public/zones` keep their existing public URLs but are served by one dynamic `api/public/[resource].js` route, leaving the Vercel API route budget at 23/24 before the next R10 domain adds surface area.
- Settings-records authority slice: `public.locations` and `public.app_issue_reports` are served through one grouped `/api/settings/records` route. In production/API mode, locations and app issue reports read/write through the normalized API first, and app issue saves no longer create new `appIssue:*` KV mirrors in production/API authority mode. Staging has retired all matched `appIssue:*` KV mirrors; existing `location:*` mirrors, if any, remain compatibility mirrors until retirement. The staging gate reconciles settings KV records and runs a controlled settings-records API smoke.
- App-config authority slice: `public.app_config` is served through `/api/settings/config`. In production/API mode, `config:v1` reads/writes go through the normalized API first and no longer create new `config:v1` KV mirrors. Staging retired the remaining legacy key after `staging:app-config:retire-mirror` confirmed the shared KV value matched `public.app_config.config`. The staging gate reconciles old KV config only if that key is present and runs a controlled config API smoke. Adding this route leaves the Vercel API route budget at 19/24.
- Session route-budget slice: existing `/api/session/login`, `/api/session/logout`, `/api/session/me`, `/api/session/profile`, `/api/session/admin-profile`, `/api/session/change-password`, and `/api/session/initial-password` URLs are served through one dynamic `api/session/[action].js` route without changing the underlying session handlers, leaving the Vercel API route budget at 18/24.
- Diagnostics route-budget slice: existing `/api/client-errors` and `/api/system-errors` URLs are served through one dynamic `api/[diagnostic].js` route without changing the underlying audit/session handlers or their different permission boundaries, leaving the Vercel API route budget at 17/24.
- Presence authority slice: `public.technician_presence` and `/api/presence` are live. In production/API mode, technician/user presence reads and writes use the normalized API first, production/API saves no longer create new `presence:*` KV mirrors, and generic `/api/kv` writes for `presence:*` no-op so older open clients cannot recreate retired mirrors. Staging has retired all matched `presence:*` KV mirrors. The staging gate reconciles `presence:*` into `public.technician_presence` and runs a controlled `/api/presence` smoke. Adding this route leaves the Vercel API route budget at 18/24.
- First matched mirror retirement: staging deleted all matched `presence:*` and `appIssue:*` KV mirrors after guarded dry-run proof (`2 + 28` records). The follow-up residual report showed 189 KV records left, all still classified as compatibility mirrors.
- Push-subscriptions authority slice: `public.push_subscriptions` is the normalized table behind `/api/push`. In production/API mode, phone push subscribe/unsubscribe uses normalized storage first and no longer creates new `pushSubscriptions:v1` KV mirrors. The staging gate reconciles the old KV JSON list into `public.push_subscriptions` and runs a controlled subscribe/unsubscribe smoke; staging retired the remaining aggregate legacy key after `staging:push-subscriptions:retire-mirror` confirmed 3/3 legacy subscriptions in normalized storage, reducing residual KV records to 188.
- User-management server-operation slice: production/API mode routes user list/save/delete through `/api/users` instead of raw `/api/kv user:*` calls.
- User-management `app_users` authority slices: `/api/users` reads login-capable users from `public.app_users`, syncs profile writes there before writing the temporary `user:` KV mirror, and deactivates matching `app_users` rows before deleting the mirror.
- User-management profile-fields authority slice: `public.app_users` now carries technician assignment, shift/tolerance, cleaning access, notification prefs, employment, and archive/profile metadata. `/api/users` writes those fields to `app_users` before the temporary `user:` mirror, `/api/session/me` exposes the session-relevant fields, and the staging gate runs the controlled users API smoke.
- PIN-login authority slice: `public.app_users` now carries `pin_hash`, `pin_updated_at`, and `login_state`. New first-login PIN setup stores only a salted server-side `scrypt` hash in `app_users`, PIN login verifies that hash, `/api/session/me` restores CMMS PIN sessions from `app_users` before falling back to legacy `user:` records, manager-triggered reset clears the hash and marks `login_state='reset_required'`, and the staging gate runs a controlled PIN setup/login/reset smoke.
- User backfill slice: staging backfilled the remaining legacy-only `user:` KV rows into `public.app_users` without deleting KV mirrors. The reconciliation report now shows all 12 legacy `user:` rows matched to 19 `app_users` profiles with `legacyOnly=0`, `ambiguous=0`, and `parseErrors=0`; first-login password completion updates existing backfilled rows by id instead of creating duplicate profiles.
- Cleaning schema-foundation slice: `public.cleaning_zones`, `public.cleaning_rounds`, `public.cleaning_complaints`, and `public.worker_absences` are the first normalized cleaning tables/RLS target. Runtime authority still stays on the accepted `czone:`/`cround:`/`ccomplaint:`/`cabsence:` KV bridge until explicit cleaning API/driver slices are added.
- First cleaning server-operation slice: `/api/cleaning/records?resource=zones` can list/upsert/delete normalized `public.cleaning_zones` rows with the same settings-management write boundary as `czone:`.
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
