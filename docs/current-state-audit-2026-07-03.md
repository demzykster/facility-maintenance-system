# Current State Audit

Prepared for owner/Claude review.

Source checked: fresh `origin/main` at `c1fec47` after local workspace sync.
Date: 2026-07-03.

This audit describes the current app state only. It does not include the future controls-module plan.

## Baseline

Current `main` is green:

- `npm run release:check` passes.
- `npm test -- --run` passes: 90 test files, 486 tests.
- `npm run build` passes.

Build warning:

- the main JS bundle is large: about 1.75 MB, gzip about 467 KB.

This is not a release blocker by itself, but it confirms the monolith/bundle-size pressure.

## 1. Workspace And Branch Hygiene

Local workspace is now synchronized with GitHub `main`:

- branch: `main`;
- HEAD: `c1fec47`;
- local `main` matches `origin/main`;
- working tree is clean;
- open PRs: none.

Old local work was preserved before sync:

- stash: `stash@{0}: pre-sync stale cleaning-qr-ux local changes`;
- backup branch: `backup/local-main-before-sync-20260703-205847`.

Recommendation:

- keep working from current clean `main`;
- delete old stash/backup only after confirming they are no longer needed.

## 2. Remote Branch Noise

Remote branches exist without open PRs:

- `origin/codex/appissue-screenshot-ci-preflight`;
- `origin/codex/reset-active-work-after-571`;
- `origin/codex/audit-code-packet`;
- `origin/codex/first-login-verification-handoff`;
- `origin/codex/remove-activation-link-onboarding`;
- `origin/claude/clever-ride-z11u7y`.

These do not block tests or build, but they create handoff risk. A future session may treat them as unfinished work even though GitHub has no open PRs.

Recommendation:

- review and explicitly delete or document these branches.

## 3. Documentation Drift

`docs/active-work.md` and `docs/handoff-for-next-codex.md` are current:

- active branch: none;
- open PRs: none;
- next action: wait for fresh owner-reported release-stabilization issues.

Other docs still contain stale or partially stale statements:

- `docs/collaboration-model.md` says not to start Supabase/Auth/RLS/Railway/database work unless explicitly started.
- `docs/release-checklist.md` contains similar out-of-scope language.
- `docs/pre-production-readiness.md` still describes Vercel as demo/staging with browser-local storage.
- `docs/current-status.md` says the public Vercel deployment uses browser-local storage, not Supabase or a production database.

This is now misleading because Supabase/Vercel/session/KV bridge work exists.

Recommendation:

- run a docs cleanup PR before large architecture work;
- keep `active-work.md` as the live handoff source, but update stale long-form docs so new sessions do not make wrong assumptions.

## 4. Main Technical Debt: Monolith

`src/ClaudeMaintenanceApp.jsx` is about 9,978 lines.

It contains:

- auth/login UI;
- dashboard;
- tickets;
- fleet;
- inspections;
- periodic maintenance;
- cleaning;
- tasks;
- meetings;
- PPE;
- suppliers;
- settings;
- app issue reporting;
- AI panel;
- large CSS block.

The large production bundle warning is consistent with this.

Current project rules correctly forbid a broad monolith split.

Recommendation:

- do not do a visual-screen split;
- when touching a domain, extract small model/business-logic files with tests;
- keep UI changes scoped.

## 5. Legacy Inspection / `שאלונים` Tails

The app has newer inspection programs per vehicle type, but old inspection templates still remain.

Current legacy pieces:

- `src/dataCollections.js`: `templates`, prefix `itpl:`, table `inspection_templates`;
- `src/ClaudeMaintenanceApp.jsx`: `TemplateForm`, `saveTpl`, `delTpl`;
- `InspectionsModule` still displays old `שאלונים`;
- `FleetTypeSettings` still displays `שאלון מקושר (ישן)`;
- `InspHistory` uses hardcoded `NEXT_DAYS = 30`;
- auto-ticket from inspection hardcodes `zone: "רחבת מלגזות"`;
- records still carry `sourceInspectionId`.

Risk:

- the system is partly program-based and partly legacy-template-based;
- users may configure the wrong thing;
- future inspection/control work may build on obsolete assumptions.

Recommendation:

- if the current legacy inspection data is not valuable, remove legacy template creation/UI;
- either keep old history read-only for a transition, or delete the old path fully in a separate cleanup PR.

## 6. Two Different Zone Models

The app currently has two incompatible location/zone models.

### Maintenance zones

- stored as strings inside `config.zones`;
- used for tickets/fleet/reporting;
- edited in maintenance settings.

### Cleaning zones

- stored as records under `czone:*`;
- mapped to `cleaning_zones`;
- object model with id, building, floor, checklist, windows, cleaner assignment, QR.

Risk:

- adding another module with its own zone list would create a third source of truth;
- string zones cannot support QR, hierarchy, metadata, analytics, or stable cross-module links as well as object records.

Recommendation:

- decide on one shared object-based location model before adding more modules that need locations.

## 7. `מטלות` Is Useful But Under-Specified

Tasks currently use:

- prefix: `mtask:`;
- table: `maintenance_tasks`.

However, the feature is already broader than maintenance:

- management tasks;
- meeting tasks;
- AI extraction from meeting notes;
- reminders;
- recurring/deferred/permanent tasks;
- linked meetings.

Current gaps:

- no `sourceFindingId`;
- no `sourceControlRunId`;
- no `sourceTicketId`;
- no `sourceModule`;
- `category` is free text;
- `locationText` is free text;
- visibility is owner/responsible/participant/admin;
- KV write rule allows `mtask:*` for `admin` and `user`, not workers/cleaners.

Risk:

- future workflows may create a second action system instead of using tasks;
- reporting and traceability will be weak without source links;
- naming/permissions say maintenance-only while actual usage is broader.

Recommendation:

- keep `מטלות`;
- define it as the shared action layer;
- add source links, structured action type/category, optional `locationId`, and clearer visibility/permission rules before connecting more workflows to it.

## 8. AI Exists But Is Not A Production Action Layer

Current AI-related pieces include:

- AI extraction from meeting text into tasks;
- AI suggestion in ticket form;
- `aiIntakeModel`;
- `docs/ai-agent-readiness.md`.

This is useful, but not a unified production AI operation layer.

There is also a concrete implementation issue in the client AI path:

- `callClaude()` in `src/ClaudeMaintenanceApp.jsx` calls `https://api.anthropic.com/v1/messages` directly from the browser;
- headers include only `Content-Type`;
- there is no `x-api-key` or provider-version header;
- when `VITE_CMMS_AI_MODE=client` enables this path, requests are expected to fail with provider authentication errors.

This should be treated as broken/experimental wiring, not as a production-ready AI feature.

Recommendation:

- keep AI as assistant/suggester/summarizer;
- do not allow AI-only data writes;
- do not enable the current browser Anthropic path as-is;
- accepted AI suggestions should go through normal product operations, permission checks, validation, and audit.

## 9. Built-In Demo Logins Remain In Source

`src/ClaudeMaintenanceApp.jsx` still contains `BUILTIN_LOGINS` with demo credentials, including real-looking company email addresses and simple passwords/PINs.

The code comment says production mode disables this list through seed policy, and the production seed policy is intentional. However, these credentials still live in source code and can confuse reviewers or future sessions.

Risk:

- source contains real-looking credentials even if production disables them;
- future work may accidentally treat them as valid production users or support data;
- security review noise remains.

Recommendation:

- before production hardening, replace real-looking emails with unmistakable demo/local identities or move demo identities into a safer demo-only fixture;
- keep production mode disabling built-in identities.

## 10. Backup And Storage Are Better Than Some Docs Suggest

`src/backupModel.js` builds backups from `DATA_COLLECTIONS`.

Current backup version is `v3`.

Earlier historical concerns about PPE/tasks/meetings being omitted from backup appear to have been addressed.

Risk:

- stale docs still contain old warnings and may mislead new sessions.

Recommendation:

- update stale documentation rather than re-solving already fixed backup issues.

## 11. Items To Close Before Large Work

Recommended cleanup list before starting major new functionality:

1. Review/delete stale remote branches without PRs.
2. Update stale docs about Supabase/demo/localStorage.
3. Remove or freeze legacy `שאלונים` / `inspection_templates`.
4. Decide how to converge `config.zones` and `czone:*`.
5. Decide whether `מטלות` is formally the shared action layer; code already suggests yes.
6. Mark or fix the current broken client AI path before enabling AI.
7. Replace real-looking built-in demo login emails/passwords before production hardening.
8. Avoid a broad monolith split; extract only small tested model logic when touched.

## Summary

The current app is working and green by tests/build. The immediate risk is not a failing baseline. The risk is accumulated ambiguity:

- stale remote branches;
- stale docs;
- legacy inspection templates;
- two zone models;
- tasks behaving as a shared action layer while still named/permissioned as maintenance;
- broken/experimental browser AI wiring;
- built-in demo credentials in source;
- one very large UI monolith.

These should be cleaned or documented before building large new workflows.
