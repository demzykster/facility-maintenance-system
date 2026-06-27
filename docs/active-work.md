# Active Work Ledger

This is the first file every Codex session must read. It is the live handoff point, not the project history.

## Required Rule

Before answering project-status questions or starting work:

1. Run `git fetch origin --prune`.
2. Check current branch, working tree, latest `origin/main`, open PRs, and remote branches.
3. Read this file first.
4. Read only the extra docs needed for the current task.

If `main`, open PRs, remote branches, or docs disagree, start with:

```text
PROBLEM:
```

Then explain what is inconsistent, why it is risky, and the safe options.

## Current Active Item

### Active branch: `codex/supabase-audit-sink`

- Status: this PR adds the concrete Supabase audit sink/table for server-side audit events.
- Latest synchronized `main`: `8f4526e [skip vercel] feat: audit sensitive kv writes`.
- Open PRs: none at branch start.
- Purpose:
  - continue R9 Production Backend Foundation from `docs/production-hardening-plan.md`.
  - current production step: add a durable Supabase `audit_events` sink/table and wire it behind `CMMS_AUDIT_DRIVER=supabase`.
  - next production step: decide whether production release gate should require audit driver before pilot/production.
  - production seed/bootstrap boundary is now defined; do not add frontend hardcoded production admin credentials.
  - current demo/local records are fake and are not a production migration source.
  - target production platform is Vercel frontend + Supabase Postgres/Auth/RLS/Storage.
  - first-admin bootstrap now has a server-only endpoint contract; do not add frontend hardcoded production admin credentials.
  - production storage provider boundary is now defined; do not treat local browser storage as production data storage.
  - `npm run release:check` now blocks production mode if storage still points at local/browser storage.
  - future broad modules such as budget and safety inspections must reuse shared CMMS entities instead of creating duplicate systems.
- Validation:
  - `npx vitest run tests/supabaseAuditDriver.test.js tests/kvApiHandler.test.js --reporter=verbose` passed.
  - `npm test -- --run` passed.
  - `npm run build` passed.
  - `VITE_CMMS_APP_MODE=production VITE_CMMS_STORAGE_PROVIDER=api VITE_CMMS_STORAGE_API_URL=https://cmms.example/api VITE_SUPABASE_URL=https://supabase.example VITE_SUPABASE_ANON_KEY=anon npm run build` passed.
  - `VITE_CMMS_APP_MODE=production VITE_CMMS_STORAGE_PROVIDER=api VITE_CMMS_STORAGE_API_URL=https://cmms.example/api CMMS_KV_AUTH=supabase CMMS_KV_DRIVER=supabase CMMS_AUDIT_DRIVER=supabase CMMS_FILE_DRIVER=supabase CMMS_FILE_BUCKET=cmms-files SUPABASE_URL=https://supabase.example SUPABASE_ANON_KEY=anon SUPABASE_SERVICE_ROLE_KEY=service npm run release:check` passed.
  - `npm run release:check` passed for default demo/local config.
  - Browser smoke-check not needed: this branch changes only server-side model/permission policy/docs, not UI/runtime wiring.

## Latest Completed Work

- R9 sensitive KV audit sink wiring is complete in PR #301.
  - `/api/kv` can send audit events for successful sensitive `PUT`/`DELETE` writes when an audit sink is configured.
  - Ordinary workflow bridge records remain outside this sensitive audit bridge.
  - Without an audit sink, existing storage behavior stays unchanged.
  - Local tests, production builds, and release checks passed.
- R9 sensitive KV audit contract is complete in PR #300.
  - The existing sensitive KV write rules now map protected key families to audit entity types.
  - `sensitiveKvWriteAuditEvent` builds audit events for protected KV writes without changing runtime API behavior.
  - Ordinary workflow records such as tickets and PPE requests remain outside this sensitive KV audit bridge.
  - Local tests, production builds, and release checks passed.
- R9 production audit event contract is complete in PR #299.
  - `src/auditEventModel.js` defines the first shared audit event shape for sensitive production changes.
  - `docs/production-audit-events.md` documents the future `audit_events` table fields.
  - This is a contract step only; it does not yet persist audit rows server-side.
  - Local tests, production builds, and release checks passed.
- R9 production file metadata contract is complete in this PR.
  - `src/fileMetadataModel.js` defines the first shared ownership metadata shape for protected files.
  - `docs/production-file-metadata.md` documents the future `file_metadata` table fields.
  - This is a contract step only; it does not yet persist metadata rows server-side.
  - Local tests, production builds, and release checks passed.
- R9 cleaning photo file-adapter wiring is complete.
  - Production+API mode stores cleaning complaint photos and cleaning round issue photos through `/api/files`.
  - Cleaning records now keep `photoPath` / `hasPhoto` metadata instead of embedded production base64.
  - Demo/test/local mode still keeps existing inline cleaning photos so current local review data remains compatible.
  - Facility tickets spawned from cleaning complaints can still receive the complaint photo, including when the complaint was already stored by path.
  - Local tests, production build, release checks, and browser smoke-check passed.
- R9 first ticket photo file-adapter wiring is complete.
  - Production+API mode now stores ticket before/after photos through `/api/files` and keeps `photoPath` / `afterPhotoPath` metadata on ticket records.
  - Demo/test/local mode still uses the existing `photo:*` records, so current local review data and backup behavior stay compatible.
  - Cleaning complaint/round photos are now handled by the same file API boundary.
  - Local tests and production build passed.
- R9 API file adapter is complete.
  - `src/apiFileAdapter.js` adds upload/download/delete calls for `/api/files` and sends the production Supabase access token when available.
  - The adapter is now used by ticket photo flows and cleaning photo flows.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 server file API foundation is complete.
  - `/api/files` now requires a Supabase user bearer token, blocks disabled users and first-password-change users, and is closed until Supabase Storage env is configured.
  - `api/files/supabaseFileDriver.js` uploads, downloads, and deletes objects through Supabase Storage using server-only service role credentials.
  - Ticket and cleaning photo writes/reads now use `/api/files` in production+API mode; demo/local review data remains compatible.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 production AI boundary is complete.
  - Production defaults AI mode to `disabled`; direct browser AI provider calls are forbidden by the release gate.
  - Browser AI controls are hidden unless frontend AI mode is explicitly `client`, which remains a demo/local mode.
  - `docs/production-ai.md` documents the safe production modes: disabled now, server endpoint later.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 production file-storage gate is complete.
  - `npm run release:check` now blocks production mode unless file/photo storage is explicitly configured with `CMMS_FILE_DRIVER=supabase` and `CMMS_FILE_BUCKET`.
  - `docs/production-file-storage.md` documents that current `photo:*` KV/base64 flows remain demo/local only and must move to server-side Supabase Storage before real production use.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 production server KV config gate is complete.
  - `npm run release:check` now blocks production API storage unless the server-side KV bridge is configured for Supabase auth, Supabase driver, URL, anon key, and service role key.
  - The gate reports storage API URL problems before server env problems, so release feedback stays readable.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 sensitive KV write guard is complete.
  - `/api/kv` now checks existing module permission levels before Supabase-authenticated `PUT`/`DELETE` on sensitive bridge keys.
  - User records require `users:manage`; system/fleet/settings bridge records require `settings:manage`; PPE catalog/order records require `ppe:manage`.
  - Ordinary workflow records such as tickets, PPE requests, cleaning rounds, and cleaning complaints remain available to active authenticated users until those flows move to normalized tables/RLS.
  - Local tests, production build, production-mode API build, and release checks passed.
- R9 first-admin bootstrap contract is complete.
  - `POST /api/bootstrap/admin` is disabled by default and requires `CMMS_BOOTSTRAP_ENABLED=true`, `CMMS_BOOTSTRAP_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
  - The endpoint creates the initial admin through Supabase Auth Admin semantics and never returns the temporary password.
  - `docs/production-bootstrap.md` documents the one-time bootstrap flow and the requirement to disable bootstrap after success.
  - Local tests passed.
- R9 Supabase Auth/RLS foundation has started.
  - `supabase/migrations/20260627173000_app_users_permissions.sql` creates `public.app_users`, permission helper functions, and initial RLS policies.
  - `src/supabaseProfileModel.js` records the app-user/profile contract and keeps permission levels aligned with the current UI permission model.
  - `docs/supabase-auth-rls-foundation.md` documents the identity/profile split.
  - Local tests, production build, production-mode API build, and release check passed.
- R9 first-admin bootstrap now creates the CMMS app-user profile.
  - `POST /api/bootstrap/admin` creates both the Supabase Auth user and the matching `public.app_users` profile.
  - The endpoint only returns success after both records exist.
  - If profile creation fails after Auth creation, it reports `authUserCreated` and `authUserId` for manual cleanup/retry instead of pretending bootstrap succeeded.
  - Local tests, production build, production-mode API build, and release check passed.
- R9 server session adapter is complete.
  - `GET /api/session/me` accepts a Supabase access token, verifies the Auth user through Supabase, then reads the matching `public.app_users` profile.
  - The endpoint uses `SUPABASE_ANON_KEY` and the user's bearer token, not the service role key.
  - Missing, disabled, unlinked, or mismatched profiles are rejected.
  - Local tests, production build, production-mode API build, and release check passed.
- R9 production login adapter is complete.
  - Production mode uses Supabase password login and then calls `/api/session/me` to create a normalized CMMS session.
  - Demo/test login remains unchanged and still uses local/demo identities.
  - Production session payload now carries the `public.app_users.id` as the CMMS session id and keeps `authUserId` separately.
  - Local tests, production build, production-mode API build, release check, and browser smoke-check passed.
- R9 production password-change enforcement is complete.
  - `POST /api/session/change-password` changes a flagged user's Supabase password and clears `public.app_users.must_change_password`.
  - Production login blocks normal app entry while `mustChangePassword` is true and shows a first-password-change form.
  - Demo/test login remains unchanged.
  - Local tests, production build, production-mode build, release check, and browser smoke-check passed.
- R9 production session persistence is complete.
  - Production login stores Supabase access/refresh tokens in browser storage according to the Remember checkbox.
  - App startup restores production sessions through `/api/session/me`, not by trusting the old local CMMS session object.
  - Expired access tokens are refreshed through Supabase before session restore.
  - Demo/test session restore remains unchanged.
  - Local tests, production build, production-mode build, release check, and browser smoke-check passed.
- R9 Supabase KV bridge driver is complete.
  - `/api/kv` gains a `CMMS_KV_DRIVER=supabase` path backed by `public.cmms_kv_records`.
  - This is a Postgres bridge for shared durable storage before final normalized business tables are wired.
  - Local tests, production build, production-mode build, and release check passed.
- R9 API storage auth header is complete.
  - The frontend API storage adapter sends the production Supabase access token as `Authorization: Bearer ...` when available.
  - This prepares `/api/kv` to move from temporary bearer-token auth to Supabase user-session auth.
  - Local tests, production build, production-mode build, and release check passed.
- R9 Supabase KV auth is complete.
  - `/api/kv` gains `CMMS_KV_AUTH=supabase` to verify Supabase user bearer tokens before storage access.
  - Disabled users and users still requiring first-password change are blocked.
  - Local tests, production build, production-mode build, and release check passed.
- R9 production data collection mapping is complete in PR #269.
  - `src/dataCollections.js` maps current backup keys and storage prefixes to future production table names.
  - `src/backupModel.js` now uses the same collection map, so backup coverage and production metadata share one source of truth.
  - `docs/production-data-model.md` documents the first database table map.
  - Local tests, production build, and browser smoke-check passed.
- R9 modular growth architecture is being documented.
  - Future budget and safety-inspection modules should reuse shared CMMS users, departments, tickets, assets, suppliers, files, lifecycle/status history, notifications, permissions, analytics, and audit.
  - The goal is comfortable modernization without duplicate module-specific islands.
- R9 production seed policy is complete.
  - `src/seedPolicyModel.js` defines demo/test/production seed behavior.
  - `VITE_CMMS_APP_MODE=production` disables demo seed loading and built-in demo identities.
  - `docs/production-seed-policy.md` documents that the first production admin must come from a server/bootstrap process, not frontend source code.
  - Owner clarified that current demo/local users, tickets, fleet, PPE, cleaning, suppliers, and history are fake data and must not be migrated into production.
  - Local tests, default production build, production-mode build, and browser smoke-check passed.
- R9 production storage provider policy is complete.
  - `src/storageProviderModel.js` defines local/api storage provider policy and marks production+local storage as not production-data-ready.
  - `src/apiStorageAdapter.js` defines the first REST key/value storage client contract for a future backend.
  - `/api/kv` route skeleton exists and is closed by default without server auth/backend storage.
  - `/api/kv` can now use an Upstash/Vercel Redis REST driver through server-only env.
  - Upstash/Vercel Redis REST is the first selected durable `/api/kv` driver path.
  - Upstash is a bridge/cache path, not the final CMMS database.
  - `docs/production-platform-decision.md` selects Supabase Postgres/Auth/RLS/Storage as the target production platform.
  - `docs/production-storage-provider.md` documents the env variables and API contract.
  - Local tests, default production build, production API-provider build, and browser smoke-check passed.
- R9 production config gate is complete.
  - `src/productionConfigGateModel.js` and `tools/production-config-gate.mjs` provide `npm run release:check`.
  - The gate allows demo/local development but blocks `VITE_CMMS_APP_MODE=production` when storage is still local/browser storage.
  - The gate warns that server Auth/RLS/files/AI still require backend implementation.
- R9 Production Backend Foundation has started in PR #268.
  - The frontend storage adapter was extracted from `src/ClaudeMaintenanceApp.jsx` to `src/storageAdapter.js`.
  - The adapter stays lazy so it can use `window.storage` after module import and later be swapped for a backend provider.
  - Adapter tests cover memory fallback, late external storage availability, and timeout failure handling.
  - `docs/production-hardening-plan.md` now tracks the production risk order: database, Auth/RLS, files/photos, server-side AI, migration, and monolith extraction policy.
  - Local tests, production build, browser smoke-check, and Vercel passed.
- R8 Ticket Lifecycle, Export And Analytics Trust is complete in PR #264.
  - Transport duplicate review was checked: it is scoped to the same transport unit, prioritizes open tickets, and only shows recent closed tickets when no open same-unit ticket exists.
  - Ticket Excel export and Analytics use shared lifecycle helpers for both transport (`שינוע`) and facility/building (`מבנה`) tickets.
  - Backdated transport equipment receipt now uses the factual transition time, so waiting time is not overcounted in lifecycle analytics/export.
  - Local tests, production build, browser smoke-check, and Vercel passed.
- Final R5 closure pass: Screen Audit And Visual Noise is complete.
  - Browser pass covered `קריאות`, `אנליטיקה`, `ביגוד עובדים`, `הגדרות`, `צוות ומשתמשים`, `כלי שינוע`, and `בקרת ניקיון`.
  - Visible controls on those screens had text, an accessible label, a title, or a clear field label/placeholder context.
  - No product-code change was needed in the final pass.
- R6 worker onboarding polish is complete.
  - New worker/cleaner activation links explain that the worker must be saved before the link can be copied.
  - Existing worker/cleaner activation/reset links explain that the new link must be saved before copying.
  - Browser smoke-check covered new worker and existing temporary-code worker flows.
  - Local tests and production build passed.
- R7 pre-production guardrails are complete.
  - `docs/pre-production-readiness.md` names Vercel as demo/staging and documents localStorage/demo-only limits.
  - Backup/restore coverage was verified against `BACKUP_COLLECTIONS` and the backup model tests.
  - Supabase/Auth/RLS/database/Railway/broad modular split remain out of scope until the owner starts that phase.
- PR #257: Driver-board warning dismiss icon now has an explicit label.
  - The warning close icon exposes `סגירת הודעה`.
  - Warning dismiss behavior stayed unchanged.
  - Local tests/build/browser smoke-check/source-check passed before merge; Vercel was blocked by build-rate limit.
- PR #256: Pending driver request approve/reject icon buttons now have explicit labels.
  - Labels include the driver name and unit code.
  - Driver request approval/rejection behavior stayed unchanged.
  - Local tests/build/browser smoke-check/source-check passed before merge; Vercel was blocked by build-rate limit.
- PR #255: PPE purchase-order manual suggestions now use net deficits.
  - Manual item quantity suggestions account for already-open PPE orders.
  - Purchase-order saving, receiving, and stock movement behavior stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #254: PPE purchase-order remove-line icon buttons now have explicit labels.
  - Labels include the item name and size where relevant.
  - Order line removal behavior and order data stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #253: PPE purchase-order empty form now explains manual order creation.
  - Empty order forms now tell the user to choose an item/size and add quantities.
  - PPE order data, stock calculations, and save behavior stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #252: Team/User Management now warns about possible duplicate login identities.
  - Active users sharing the same email, worker number, or technician code are counted in a visible warning.
  - User records, login behavior, editing, and rendering stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #251: Active work ledger was closed after the permissions summary pass.
  - No active product branch remained after PR #250.
  - Next exact action points to the `צוות ומשתמשים` user tree/group-list pass.
  - Docs-only validation passed; Vercel was blocked by build-rate limit.
- PR #250: User form personal-permissions block now shows a compact collapsed summary.
  - Manager forms show whether extra module permissions are present without opening the block.
  - Permission storage and editing behavior stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #249: Remaining smaller icon-only buttons now expose descriptive labels.
  - Driver actions, ticket wizard back, duplicate modal close, checklist issue toggle, and notification settings are named.
  - Behavior and layout stayed unchanged.
  - Local tests/build/source-check passed before merge; notification settings browser smoke-check passed. Vercel was blocked by build-rate limit.
- PR #248: PM calendar/year navigation icon buttons now expose descriptive labels.
  - Calendar month navigation exposes `חודש קודם` and `חודש הבא`.
  - Yearly view navigation exposes `שנה קודמת` and `שנה הבאה`.
  - Calendar/matrix navigation behavior and layout stayed unchanged.
  - Local tests/build/browser smoke-checks passed before merge; Vercel was blocked by build-rate limit.
- PR #247: Fleet and periodic-maintenance detail edit icon buttons now expose descriptive labels.
  - Fleet edit exposes `עריכת כלי`; PM edit exposes `עריכת טיפול תקופתי`.
  - Edit behavior and modal layout stayed unchanged.
  - Local tests/build/browser smoke-checks passed before merge; Vercel was blocked by build-rate limit.
- PR #246: Ticket-detail header icon buttons now expose descriptive labels.
  - Back exposes `חזרה מרשימת הקריאה`; repeat exposes `פתיחת קריאה דומה`.
  - Back/repeat behavior and modal layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #245: Task and meeting detail edit icon buttons now expose descriptive labels.
  - Task edit exposes `עריכת מטלה`; meeting edit exposes `עריכת פגישה`.
  - Edit behavior and modal layout stayed unchanged.
  - Local tests/build/browser smoke-check/source-check passed before merge; Vercel was blocked by build-rate limit.
- PR #244: Cleaner/manager zone card action buttons now expose descriptive labels.
  - Zone spec and report issue actions include the zone name.
  - Zone action behavior and layout stayed unchanged.
  - Local tests/build/source-check passed before merge; Vercel was green.
- PR #243: Cleaning-zone admin card action buttons now expose descriptive labels.
  - Report issue, QR label, and edit actions include the zone name.
  - Cleaning-zone action behavior and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #242: Ticket note send icon button now exposes a descriptive label.
  - The admin ticket update send action is named for assistive tech/browser inspection.
  - Note submission behavior and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #241: Worker topbar icon buttons now expose descriptive labels.
  - Theme toggle and logout icon-only controls are named for assistive tech/browser inspection.
  - Theme toggle, logout behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #240: Active work ledger closed the search-label pass.
  - No active product branch remained after PR #239.
  - Docs-only validation passed; Vercel was blocked by build-rate limit.
- PR #239: Driver-access search field now exposes a descriptive label.
  - The hidden AccessPicker search no longer relies only on placeholder text.
  - Driver access filtering, selection behavior, and layout stayed unchanged.
  - Local tests/build/code-search passed before merge; Vercel was blocked by build-rate limit.
- PR #238: Task people-picker search field now exposes a descriptive label.
  - The responsible-person picker search no longer relies only on placeholder text.
  - People-picker filtering, selection behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #237: Driver coverage search field now exposes a descriptive label.
  - The visible `נהגים / כיסוי` search input no longer relies only on placeholder text.
  - Driver coverage filtering, selection behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #236: Activity-log search field now exposes a descriptive label.
  - The `יומן פעילות` search input no longer relies only on placeholder text.
  - Activity-log filtering/export behavior and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #235: Task search field now exposes a descriptive label.
  - The main `מטלות` search input no longer relies only on placeholder text.
  - Task filtering, search behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #234: PM/unit picker search field now exposes a descriptive label.
  - The unit picker search used by PM scheduling no longer relies only on placeholder text.
  - Unit-picker filtering, selection behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #233: Fleet search field now exposes a descriptive label.
  - The main `כלי שינוע` search input no longer relies only on placeholder text.
  - Fleet filtering, search behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #232: Supplier search/add fields now expose descriptive labels.
  - Supplier search and add-new fields no longer rely only on placeholder text.
  - Supplier filtering, add behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was blocked by build-rate limit.
- PR #231: Cleaning-zone delete icon buttons now expose descriptive labels.
  - Checklist item deletes and round-window deletes are named by item/time.
  - Cleaning-zone form behavior, save logic, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #230: General settings delete icon buttons now expose descriptive labels.
  - Wait-reason and downtime-level delete actions are named by item.
  - Wait-reason/downtime behavior, blocking, and save logic stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #229: PPE movement search field now exposes a stable descriptive label.
  - The `ביגוד עובדים -> תנועות מלאי` search input no longer relies only on placeholder text.
  - Movement search, filtering, export, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #228: Analytics asset wording now uses clearer Hebrew.
  - Visible `אקטיב/אקטיבים` wording was replaced with `כלים/ציוד`.
  - Analytics calculations, filters, and drill-down behavior stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #227: Ticket search field now exposes a stable descriptive label.
  - The `קריאות` search input no longer relies only on placeholder text.
  - Search behavior and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #226: Bottom role-switch icon buttons now expose descriptive labels.
  - Each demo role button has Hebrew `aria-label` text.
  - Role-switch behavior and placement stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #225: Floating AI action now exposes a descriptive label.
  - The AI button has Hebrew `aria-label` and tooltip text.
  - AI behavior and placement stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #224: Team/settings delete icon buttons now expose descriptive labels.
  - Worker-shift deletes and shared registry deletes are named by item.
  - Delete blocking, save behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #223: Worker-shift color pickers now expose descriptive labels.
  - Color inputs in `צוות ומשתמשים -> הגדרות` are labeled by shift name.
  - Worker-shift data, save behavior, and layout stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #222: Worker exit/equipment return action now uses a clearer icon.
  - The misleading hard-hat icon was replaced with the existing package/check icon.
  - Offboarding behavior and copy stayed unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #221: Active work ledger closed the #220 ledger gap.
  - `docs/active-work.md` now points at PR #220 as the latest synchronized main before this pass.
  - Docs-only validation passed; Vercel was green.
- PR #220: Active work ledger closed the user-tree group PR.
  - No active product branch remained after PR #219.
  - Docs-only validation passed; Vercel was green.
- PR #219: User-tree group toggles now expose expanded/collapsed state.
  - Group buttons use `type="button"` and `aria-expanded`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #218: Read-only user cards no longer show clickable hover feedback.
  - Non-actionable user cards get an `inert` class.
  - The inert hover state no longer lifts or shadows the card.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #217: Read-only user cards are no longer dead buttons.
  - User tree rows render as buttons only when the viewer can edit users.
  - Read-only rows render as non-actionable cards.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #215: Active work ledger closed the permission-select PR.
  - No active product branch remained after PR #213.
  - Vercel was green.
- PR #213: User permission selects are now self-describing.
  - Personal permission selects expose Hebrew `הרשאה: ...` labels.
  - Permission behavior remains unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #212: UserForm save action now names what is saved.
  - User forms show `שמירת משתמש`; worker-locked forms show `שמירת עובד`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #211: Active work ledger now reflects the merged add-user polish.
  - No active product branch remains after PR #210.
  - Docs-only validation passed; Vercel was green.
- PR #210: User-management add action now reads clearly.
  - The button changed from generic `משתמש` to `הוסף משתמש`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #209: PPE signature template textarea is now labeled.
  - The field exposes `תבנית אישור קבלת ציוד` for assistive tech and browser inspection.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #208: PPE clawback remove action is now labeled.
  - The icon-only remove-row buttons expose `הסר מדרגת קיזוז` as both `aria-label` and tooltip.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #207: PPE department requirement counts now ignore inactive/missing catalog items.
  - The department label no longer reports stale hidden norms as active setup.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #205: Empty PPE movement export is no longer a dead action.
  - The export button is disabled when there are no movement rows.
  - The disabled button exposes `אין נתונים לייצוא`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #204: PPE purchase-order empty copy now matches its embedded location.
  - The movement-log order block no longer references unavailable `הזמנה/מהחוסרים` actions.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #203: PPE catalog add action now reads clearly.
  - The catalog button changed from generic `פריט` to `הוסף פריט`.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #202: Empty PPE catalog now guides users to catalog setup.
  - The dashboard shows `הוסף פריט לקטלוג` instead of a visible purchase-order action when there are no active catalog items.
  - The purchase-order action now redirects to catalog setup if no active items exist.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #201: PPE month picker icon controls now have clear labels/tooltips.
  - Month, year, and chooser icon buttons expose Hebrew `title` and `aria-label` text.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #200: Lifecycle analytics/export labels now distinguish technician acceptance.
  - Routed-but-unaccepted technician tickets use the `ממתין לקבלה` lifecycle stage.
  - Analytics drill-down opens the exact matching ticket list.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #199: Ticket cards now show technician-acceptance state clearly.
  - Cards waiting for a technician to accept show `ממתין לקבלה` instead of the misleading raw `חדשה` badge.
  - Underlying ticket status/data remains unchanged.
  - Local tests/build/browser smoke-check passed before merge; Vercel was green.
- PR #198: Ticket drill-down filters are easier to understand and clear.
  - Dashboard/analytics drill-down banner now has an explicit `נקה סינון` action.
  - The admin ticket filter row now keeps four filters in one balanced row at desktop width.
  - Local tests/build/browser smoke-check passed before merge; Vercel was rate-limited.
- PR #196: Admin role-switch now prefers an assigned cleaner when available.
  - Role-smoke passed for admin, manager, technician, and worker.
  - Cleaner shell rendered cleanly; when no assigned cleaner exists in current local data, the empty-zone state is expected.
  - Vercel was rate-limited, but local tests/build/browser role-smoke passed before merge.
- PR #194: Manager/user PPE management access is now directly visible when permitted.
  - `ביגוד עובדים` appears in the manager/user sidebar only for `ppe:manage` or `ppe:full`.
  - Ordinary request-only managers remain on the existing department/PPE request path to avoid sidebar noise.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #193: Manager/user Settings access is now visible when permitted.
  - `הגדרות` appears only when the session has `settings:manage`.
  - Sensitive settings actions remain behind `settings:full`.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #192: Manager/user Analytics access is now visible when permitted.
  - `אנליטיקה` appears only when the session has `analytics:view`.
  - Manager/user analytics opens in read-only mode; damage report edit controls do not save from this route.
  - Vercel was green before merge.
- PR #191: Manager/user Suppliers access is now visible when permitted.
  - `ספקים / קבלנים` appears only when the session has `suppliers:view`.
  - Editing remains gated by `suppliers:manage`.
  - Vercel was blocked by deployment rate limit; local tests/build/browser smoke-check passed before merge.
- PR #190: Manager/user Audit Log access is now gated.
  - `יומן פעילות` appears only when the session has `audit:view`.
  - Vercel was green before merge.
- PR #189: R3 notification release package was closed.
  - `docs/release-checklist.md` now marks Notifications End-To-End done in PRs #180-#188.
  - Docs-only validation: `git diff --check`.
- PR #188: Department notifications now focus exact fleet cards.
  - Manager/user PM and driver outcome notifications pass `fleetId` into department fleet navigation.
  - Vercel was rate-limited, but local tests/build/browser smoke-check passed before merge.
- PR #187: PPE notifications now focus relevant sub-tabs.
  - Admin PPE pending/low-stock notifications open the PPE dashboard; open-order notifications open the inventory movement/order tab.
  - Local tests/build/browser smoke-check passed before merge.
- PR #185: Fleet notifications now focus the exact unit card.
  - Admin fleet document and driver request notifications pass `fleetId` into Fleet navigation.
  - Local tests/build/browser smoke-check passed before merge.
- PR #184: Notification matrix ledger was closed.
  - `docs/active-work.md` returned to the current R3 route.
  - Vercel was green before merge.
- PR #183: Department notification route matrix was corrected.
  - The route map now reflects the actual department equipment target.
  - Docs-only validation: `git diff --check`.
- PR #182: Cleaner notifications now route to Cleaning.
  - Cleaning due/overdue and complaint notifications open `בקרת ניקיון`.
  - Local tests/build/browser smoke-check passed before merge.
- PR #181: Team notifications now route to Users.
  - Technician shift notifications open `צוות ומשתמשים`.
  - Local tests/build/browser smoke-check passed before merge.

Older completed work is available in GitHub history and, when needed, in:

- `docs/archive/progress-log.md`
- `docs/archive/validation-log.md`

## Next Exact Action

1. Ask the owner for the next product priority, or fix the next owner-reported critical bug.
2. If no critical bug is reported, start a new explicit release package before broad work.
3. Do not start Supabase/Auth/RLS/database/Railway/broad modular split until the owner explicitly opens that phase.

## Documentation Policy

- Keep this file short: current state, last few PRs, next action, blockers.
- Do not use this file as a full PR history. GitHub already does that.
- Update `docs/active-work.md` when:
  - work pauses with an unmerged branch;
  - a product strategy or next action changes;
  - a major block closes;
  - the current contents would mislead the next session.
- Do not update it for every tiny merged PR if `main` is clean and the next step is obvious.
- Update `docs/backlog.md` only when a task is opened, closed, or reprioritized.

## Validation Policy

For code changes:

- `npm test -- --run`
- `npm run build`
- browser smoke-check for UI behavior changes

For docs-only changes:

- `git diff --check` is enough unless package/config/code behavior changes.

## Current Product Direction

- Continue Phase 2 stabilization.
- Current focus: focused UI audit/polish, permissions/onboarding only when explicitly selected, and CMMS workflow correctness.
- Do not add new one-off user-card checkboxes.
- Use `perms` and helpers from `src/permissionModel.js` for access work.
- Worker activation/reset remains gated by `workerAccess:manage`.
- Do not start Supabase/Auth/RLS/Railway/database work.
- Do not do a broad modular split.
- Do not replace `src/ClaudeMaintenanceApp.jsx` as a whole file.

## Handoff Back Rule

When handing work back:

- state the branch;
- state the latest commit;
- state whether it is merged into `main`;
- state the next exact action;
- state which checks passed or were not run;
- state blockers using `PROBLEM:`.
