# Handoff For Next Codex

Updated: 2026-07-13

## Startup Checklist

- Repo: `/Users/Vadim/Documents/CMMS`
- Source of truth: GitHub `demzykster/facility-maintenance-system`, branch `main`.
- Current local state at handoff time: `main...origin/main`, expected clean after the latest push.
- Latest app/UI commit before this handoff: first-login password session stabilization and AI entry points for management tasks/meetings, after explicit AI waiting-reason update proposals, deterministic AI supplier-routing proposals, supplier summaries in AI context, AI provider connection check, deterministic AI ticket comment proposals, deterministic ticket update proposals, constrained update execution, and AI ticket proposal form handoff.
- Product line: v1/main only.
- Active branch: none.
- Open PRs at last local handoff: none.
- Start every new session with:
  - `git status --short --branch`
  - `git fetch origin main`
  - `git log --oneline -5`
  - read `docs/active-work.md`

## Current Project Goal

The owner wants the existing v1 CMMS to reach a calm, usable, controlled-rollout state before any large architectural redesign.

The current strategy is:

1. Keep `main` stable and deployable.
2. Continue small, scoped fixes only.
3. Preserve the current monolithic UI for now; do not start a broad component split.
4. Keep production/API data authority normalized; do not recreate old KV mirrors.
5. Improve visual quality screen by screen without breaking workflows.
6. Keep mobile/iPhone usability tight: compact operational cards, no horizontal overflow, readable touch targets.
7. Leave a fresh independent architecture/security review and larger monolith/code-splitting work as later steps, not ad hoc nightly work.

## Current Product Status

- Status is best described as `production_candidate accepted for controlled rollout`, not `final_production`.
- R10 production data-core is effectively complete for the currently mapped v1 domains:
  - tickets;
  - fleet;
  - periodic maintenance;
  - users / `app_users`;
  - cleaning;
  - PPE;
  - work records;
  - settings records;
  - app config;
  - presence;
  - push subscriptions;
  - ticket photos / file metadata.
- Staging residual KV report previously reached `cmms_kv_records=0`.
- Route budget is `19/24` after grouping AI URLs through one dynamic `api/ai/[action].js` route.
- Known product/performance risk remains the large main JS chunk. The latest builds pass but still warn about a chunk above 500 kB.
- First startup splits after that warning are done: `html2canvas` is no longer part of the initial app chunk and loads only when the app issue screenshot capture is used; the AI chat panel now lives in `src/AIPanel.jsx` and loads only when the AI UI is opened; the unified BI overview now lives in `src/BIOverview.jsx` and loads through a lazy wrapper from the app shell; the fleet/transport and periodic-maintenance screen now lives in `src/FleetAssetsModule.jsx` and loads only when `כלי שינוע` is opened; management tasks/meetings live in the lazy `src/ManageHub.jsx` module. React and lucide icons are split into stable vendor chunks for better cache behavior across deploys. The latest local build has the main app chunk around 231.45 kB gzip, with vendor React around 57 kB gzip, vendor icons around 101 kB gzip, a `BIOverview` chunk around 9.15 kB gzip, `ManageHub` around 19.81 kB gzip, and `FleetAssetsModule` around 26.00 kB gzip.
- BI now includes a ticket heatmap (`מפת חום קריאות`) by department / area and risk type. The calculation lives in `src/biScopeModel.js` (`biTicketHeatmapRows`, `ticketMatchesBiHeatmapMetric`) with coverage in `tests/biScopeModel.test.js`; rendering lives in `src/BIHeatmapPanel.jsx`, and `src/BIOverview.jsx` wires it into BI and routes heatmap clicks through the existing ticket list focus mechanism.
- The live public Vercel app is staging/pilot/controlled rollout. Treat live data carefully.

## Recent Work Completed

Recent commits on `main`:

- `Stabilize first login and task AI entry`
  - First-password completion through `POST /api/session/initial-password` now returns a full normalized `app_users` profile from `createSupabaseInitialPasswordClient.completePasswordUser()` instead of only `authUserId/appUserId`.
  - The returned first-login session now carries the same important fields as ordinary production login/session restore: id, auth user id, name, role, email, department/departments, and permissions.
  - This addresses the owner-reported white-screen risk immediately after a new user creates their first password, where the app could proceed with an incomplete production session shape.
  - `tests/initialPasswordHandler.test.js` covers the full profile contract after first-password completion.
  - `src/aiAssistEntryPointModel.js` now includes `managementTasksAiPrompt()` for task/meeting management risk summaries and next-action prompts.
  - `src/ManageHub.jsx` wires task and meeting AI buttons into the shared `LazyAIPanel` through `onAskAI`; this is read-only prompt entry, not a data-writing operation.
  - `tests/aiAssistEntryPointModel.test.js` and `tests/manageHubLazyWiring.test.js` cover the prompt and wiring.
- `Add explicit AI waiting reason proposals`
  - `src/aiAssistActionModel.js` now proposes `ticket.update` waiting changes only when the user names a concrete waiting reason such as parts, supplier, access, budget approval, safety hold, or missing equipment.
  - The proposal adds both `waitingReason` and a deterministic `waitBall`; generic "put it on hold" wording produces no action proposal instead of guessing an unsafe partial status change.
  - Moving a waiting ticket back to work clears `waitingReason` and `waitBall`.
  - `src/aiAssistActionExecutionModel.js` allows those waiting fields only through the existing human-confirmed `ticket.update` execution path, so the normal `/api/tickets` validation, authorization, persistence, notifications, and audit behavior still apply.
  - `src/AIPanel.jsx` labels waiting fields in before/after update previews so the user can review the exact status/reason/responsibility change before confirming.
- `Improve AI update confirmation previews`
  - `ticket.update` proposals now include a compact `payload.current` snapshot for the fields being changed.
  - `src/AIPanel.jsx` renders update action cards as before/after rows instead of one compact text string, so supplier routing and priority/status changes are easier to review before confirmation.
  - Execution is unchanged: the confirmed action still saves only the allow-listed patch through the existing `/api/tickets` path.
- `Add deterministic AI supplier routing proposals`
  - `src/aiAssistActionModel.js` can now build a `ticket.update` proposal that sets `supplier` when the user explicitly asks to route a single visible ticket to a supplier.
  - The supplier must be present in the already role-filtered `context.suppliers` list. If the supplier is invisible, ambiguous, missing, or already assigned, no proposal is generated.
  - The proposal still does not write by itself. It uses the existing human-confirmed `ticket.update` execution path, `/api/tickets`, the allow-listed patch model, and the `ai_confirmed_update` log entry.
- `Add supplier summaries to AI context`
  - `src/aiAssistSnapshotModel.js` now includes compact supplier summaries: supplier name, type, scopes, linked fleet count, and open-ticket count.
  - `src/aiAssistContextModel.js` passes those summaries only to leadership roles or users with supplier visibility.
  - Supplier contacts, addresses, and private notes are intentionally not included in AI context.
  - This allows supplier-routing proposals to match an existing supplier from filtered context instead of guessing provider names from free text.
- `Add AI provider connection check`
  - `/api/ai/status` still returns public-safe readiness fields and never returns provider secrets.
  - Admins with full settings access can call `/api/ai/status?check=1` to run a tiny server-side provider ping against the configured model.
  - `src/AISettingsCard.jsx` exposes refresh and live connection-check actions in settings, so admins can distinguish "env configured" from "model actually responds".
  - Provider keys remain server/Vercel environment variables only; browser-managed `config.ai` still stores only non-secret mode/provider/model preferences.
- `Add deterministic AI ticket comment proposals`
  - Extends the human-confirmed AI action surface with `ticket.comment`.
  - `/api/ai/assist` can propose a comment only when the user explicitly asks to add/write a note/comment and the role-filtered context leaves exactly one visible target ticket.
  - The action remains non-writing until the user confirms it in `src/AIPanel.jsx`.
  - Browser execution uses `prepareAiTicketCommentForSave()` and the existing `saveTicket` / `/api/tickets` path, appending an `ai_confirmed_comment` log entry to the ticket history instead of creating a parallel comment API.
  - Provider text is not trusted for target selection; the target ticket comes from the already role-filtered context.
- `Add deterministic AI ticket update proposals`
  - `src/aiAssistActionModel.js` now builds the first deterministic `ticket.update` proposal.
  - The server builds proposals only after `buildAiAssistContext()` filters the supplied UI context by the authenticated user's role/scope.
  - Current update proposal scope is intentionally narrow: priority/status changes only, and only when the role-filtered context contains exactly one visible target ticket.
  - If multiple tickets are visible, no update proposal is generated; the assistant should ask the user to narrow the target instead of guessing.
  - Provider text is still not trusted for mutation payloads. The patch comes from deterministic text/intent parsing and the role-filtered context.
- `Add constrained AI ticket update execution`
  - Extends `src/aiAssistActionExecutionModel.js` from `ticket.create` to a constrained `ticket.update` action foundation.
  - `ticket.update` requires human confirmation, the normal `/api/tickets` execution contract, a matching existing ticket, no missing fields, and an allow-listed patch only.
  - Allowed update fields are intentionally narrow: priority/status/assignment/supplier/description/location/transport operational fields. System fields such as `id`, `num`, `createdAt`, `log`, and arbitrary object replacement are ignored.
  - Execution produces a field diff, appends an `ai_confirmed_update` log entry, preserves the original ticket id, and saves through the existing `saveTicket` path.
  - `src/AIPanel.jsx` can render `ticket.update` action cards with a compact diff preview. This is only the execution/display foundation; future slices must add deterministic proposal generation for concrete update scenarios instead of trusting provider free text for mutation payloads.
- `Add AI ticket proposal form handoff`
  - Adds `ticketPrefillFromAiAssistAction()` to `src/aiAssistActionExecutionModel.js`.
  - `src/AIPanel.jsx` now offers a secondary path on `ticket.create` action cards: open the normal ticket form for review/completion instead of creating immediately.
  - `UserApp` and `AdminApp` pass `openAiTicketDraft` into the lazy AI panel, so incomplete or review-first AI proposals can open the existing `TicketForm` with a safe prefill.
  - This is not a new write path. No data is written until the user manually submits the normal ticket form, and complete proposals still require explicit human confirmation before the existing `saveTicket` / `/api/tickets` path runs.
  - Technician AI panels intentionally do not receive the form-handoff prop because that shell does not own the normal new-ticket overlay.
- `Add human-confirmed AI ticket creation`
  - Adds `src/aiAssistActionExecutionModel.js`, the first browser-side execution guard for AI-produced actions.
  - `ticket.create` proposals can now be executed only when complete, only after a human presses the confirmation button, and only through the existing `saveTicket` / `/api/tickets` path.
  - `/api/ai/assist` remains read-only by itself. Provider text still does not write data and does not control payload execution.
  - `src/AIPanel.jsx` now shows disabled/ready/created/error states for action cards.
  - The follow-up form handoff now covers the first guided-completion step for incomplete proposals; future work should add richer field-specific guidance, especially for transport tickets that need a specific fleet unit and downtime type before creation.
- `Fix transport ticket forms and AI action cards`
  - Fixed the white-screen regression when opening a new transport ticket from `פתיחת קריאה`.
  - Root cause: after the fleet/PM lazy split, `TicketForm` and the worker report form still rendered `UnitPicker`, but the component only existed inside `src/FleetAssetsModule.jsx`. Facility/building ticket creation still worked; transport creation crashed with `UnitPicker is not defined`.
  - Added shared `src/UnitPicker.jsx`, wired it into the app shell and the lazy fleet module, and removed the duplicate local picker from `src/FleetAssetsModule.jsx`.
  - `tests/fleetAssetsLazyWiring.test.js` now checks that the shell ticket forms and the lazy fleet module both use the shared picker and that the picker does not drift back into the lazy module only.
  - `src/AIPanel.jsx` now renders structured assistant action proposals as small action cards while preserving old string responses.
  - Local verification: targeted tests passed, full Vitest passed, lint passed, build passed, release-check passed, and a targeted Playwright preview smoke opened both `קריאה · מבנה` and `קריאה · שינוע` without page errors.
- `Add AI ticket action proposals`
  - Adds `src/aiAssistActionModel.js`, the first safe write-action foundation for the assistant.
  - `/api/ai/assist` can now return deterministic `actions` next to the draft/assistant text. The current implemented proposal is `ticket.create`.
  - Proposals are built from the deterministic intake draft, not from free-form provider text. They are marked `requiresConfirmation: true`, `writesData: false`, and point future execution at the existing validated `/api/tickets` endpoint.
  - Missing operational fields keep the proposal in `needs_human_input` state; for example, transport tickets remain blocked until a human selects the exact fleet unit and downtime type.
  - This is not write-capable AI yet. The next slice should add UI confirmation and then server execution through normal authenticated operations, with audit and permission checks preserved.
- `Harden ticket detail lazy bridge`
  - Fixed the white-screen regression when opening lazy-loaded ticket details after the `TicketDetail` split.
  - Root cause: the lazy UI bridge still referenced stale helpers (`msFromInput`, then `normalizeTicketHistory`) and did not pass all active admin-edit helpers (`STATUSES`, `dtLevels`) required by the detail overlay.
  - `tests/ticketDetailLazyWiring.test.js` now checks that the bridge has no stale helper names and includes the active admin-edit dependencies.
  - `tests/ticketDetailRenderSmoke.test.js` renders both facility/building and transport ticket details with a mocked bridge, so the facility path is covered even when staging has no live facility ticket card to click.
  - Live verification on Vercel served `4448c9e`; `npm run staging:smoke:live -- --expect-current-commit` and `npm run staging:smoke:ui -- --expect-current-commit` passed. A targeted browser check opened a live transport ticket detail without page errors or console errors; no clickable facility/building ticket existed in current staging data.
- `Lazy load fleet assets module`
  - Extracts fleet/transport and periodic-maintenance UI from `src/ClaudeMaintenanceApp.jsx` into `src/FleetAssetsModule.jsx`.
  - Keeps the small `AssetsHub` tab switcher in the app shell, while fleet import, fleet list/detail/settings, PM calendar/list/history, PM rule scheduling, and PM execution overlays load only when the assets module is opened.
  - Adds `tests/fleetAssetsLazyWiring.test.js` so Fleet/PM do not silently drift back into the startup monolith.
  - Local build evidence after the split: separate `FleetAssetsModule` chunk about 26.39 kB gzip; main app chunk about 227.65 kB gzip. Targeted browser smoke opened `כלי שינוע` and `לוח טיפולים` without console/page/runtime errors and with no horizontal overflow.
- `Lazy load BI overview`
  - Extracts the unified BI overview from `src/ClaudeMaintenanceApp.jsx` into `src/BIOverview.jsx`.
  - Keeps heatmap rendering and AI entry prompt wiring inside the lazy BI module while the app shell passes only a small `biOverviewUi()` bridge.
  - Local build evidence after the split: separate `BIOverview` chunk about 9.13 kB gzip; main app chunk about 251.28 kB gzip. This is another scoped monolith-reduction slice, not the final performance solution.
- `Lazy-load AI panel`
  - Extracts the browser AI chat panel from `src/ClaudeMaintenanceApp.jsx` into `src/AIPanel.jsx`.
  - Uses `React.lazy` / `Suspense` so the panel is not part of the normal startup path; it loads only when the AI FAB is available and the user opens the panel.
  - The panel now supports the server-backed assistant path; the old browser `callClaude` helper remains only for demo/client fallback and old form-level experiments.
  - Adds the first server AI provider boundary in `server/ai/providerClient.js`, with tested request shapes for Anthropic/Claude and OpenAI Responses API provider mode. This is intentionally not wired as a broad production assistant yet; provider keys stay server-side and the existing `/api/ai/intake` remains a read-only draft contract.
  - Local build evidence after the split: separate `AIPanel` chunk about 1.4 kB gzip; main app chunk about 305 kB gzip. This is a small monolith-reduction slice, not the final performance solution.
- `Add authenticated AI assist endpoint`
  - Adds `POST /api/ai/assist` through `server/ai/assistHandler.js`.
  - The endpoint verifies Supabase/Auth-cookie or CMMS PIN sessions, rejects password-change-required users, rate-limits per user, builds the deterministic intake draft, and calls Anthropic/OpenAI only when `CMMS_AI_MODE=server`.
  - The endpoint is read-only by design: it does not create, update, delete, assign, approve, or close any CMMS business record. It returns the deterministic draft plus assistant text so the UI can later ask a human to confirm any real operation through the normal server APIs.
  - Provider secrets stay in deployment/server env; do not store raw keys in browser-managed app config.
- `Add AI settings and grouped route`
  - Groups existing AI URLs under `api/ai/[action].js`, preserving `/api/ai/intake` and `/api/ai/assist` while adding `/api/ai/status` without consuming another Vercel function slot.
  - Adds authenticated `/api/ai/status` through `server/ai/statusHandler.js`; it returns public-safe mode/provider/model/readiness fields and never exposes provider keys.
  - Adds `config.ai` settings in the admin general settings screen for non-secret AI preferences: mode, provider, and model.
  - Route budget returns to `19/24`.
  - The follow-up context/workflow slice wires the panel to `/api/ai/assist` in server mode, filters supplied UI context by the authenticated user's role/scope before provider calls, records non-sensitive `system / ai_assist` audit events when the audit driver is configured, and adds explicit workflow IDs for `risk_summary`, `sla_explanation`, `next_actions`, and `draft_preparation`.
  - Next AI work should deepen those workflows with richer role-specific prompts, better UI entry points, and eventually human-confirmed normal operations for any AI-prepared business action.
- `Add BI ticket heatmap`
  - Adds `מפת חום קריאות` to the unified BI screen.
  - Heatmap rows are scoped through the existing BI scope model, so admin/executive see company scope while department managers see only their permitted departments.
  - Heatmap columns cover open tickets, SLA, critical transport downtime, waiting states, aging backlog, and tickets with no recent movement.
  - Cell clicks route into the existing filtered ticket list via `focus.heatmapMetric` and `focus.department`; no parallel BI-only action path was created.
  - This is also the first small monolith-reduction slice in this area: heatmap calculation and drill-down matching are model-level functions with tests, and the heatmap renderer is a small `src/BIHeatmapPanel.jsx` component while the monolithic app remains the surrounding shell.
  - Demo and staging UI smokes now assert that the heatmap panel exists on desktop/mobile, so future BI changes should not silently remove it.
- `Tighten BI notifications and runtime rendering`
  - Notification read-state remains personal per user, and the notification panel now hides read notifications by default. Read history is available through an explicit control, so "mark all as read" clears the active list instead of leaving the same old items visually hanging.
  - Follow-up notification storage is now server-backed for production sessions: `/api/session/profile` accepts the current user's `notificationReadState` and writes it into `app_users.notification_prefs.readState`. The app still keeps localStorage as a fallback, but production read-state can now survive across devices, including CMMS PIN sessions.
  - The desktop notification panel now behaves as a side tray beside the sidebar instead of a floating/modal overlay over the menu. Mobile remains a full-height sheet.
  - `tools/staging-ui-smoke.mjs` now checks that desktop notifications do not overlap the sidebar and that mobile notifications still open as a full-width sheet, so this visual contract is covered by the live UI smoke.
  - BI gained a `גיל הקריאות` panel with drill-down filters for today, 2-7 days, 8-30 days, and over 30 days. This is not a heatmap; it is a backlog-aging signal for current open tickets.
  - BI also gained `קריאות ללא תנועה`, showing open tickets that have not been updated for over 1 day, 3-7 days, or over a week, with drill-down filters into the tickets list.
  - Mobile BI KPI cards were tightened to reduce oversized blocks on small screens.
  - Repeated long-list surfaces gained `content-visibility:auto` where supported to reduce rendering work after the app has loaded.
  - Important limitation: this pass reduced browser rendering pressure but did not reduce the main JavaScript bundle. The follow-up split below starts that work.
- `Lazy-load app issue screenshot capture`
  - `html2canvas` is now dynamically imported only inside `captureAppIssueScreenshot`, so the screenshot renderer is not parsed on normal app startup.
  - Local build evidence after the split: `html2canvas` became a separate chunk of about 46.8 kB gzip, while the main app chunk dropped to about 461.7 kB gzip.
  - Important limitation: the app still ships a large `ClaudeMaintenanceApp.jsx` bundle. The next performance pass should lazy-split a real screen group or self-contained UI module.
- `Split stable frontend vendor chunks`
  - Vite now emits stable chunks for React and lucide icons, so repeated deploys can reuse cached framework/icon code while the changing app chunk is smaller.
  - Local build evidence after the split: app chunk about 303 kB gzip, `vendor-react` about 57 kB gzip, `vendor-icons` about 101 kB gzip.
  - Important limitation: this improves caching and parse organization, not the total amount of first-load JavaScript. A real screen-level lazy split is still the next larger performance step.
- `b151d30 Stabilize user scope and supplier ticket routing`
  - Hardened `/api/users` so a scoped manager cannot overwrite an existing non-worker profile or an `authUserId`-backed elevated profile by re-saving it as a worker.
  - Preserved the scoped-manager ability to create/edit workers inside the manager's own department.
  - Kept supplier routing supplier-first: facility and transport tickets can enter the supplier queue with `ticket.supplier`, `ticket.assignee` remains blank until a technician accepts the work, and technician scope `both` can see both supplier-routed transport and facility queues.
  - Fixed leadership/executive login reset persistence so reset requests write the expected `reset_required` / `must_change_password` state.
  - Updated live UI smoke coverage to follow the current BI navigation and modal shell behavior instead of retired Dashboard/Analytics assumptions.
  - Verified with full local tests, lint, build, release check, live Vercel commit proof, live staging smoke, live UI smoke, users/tickets/PIN API smoke, and live negative-path checks for scoped-manager overwrite and executive reset.
- `Refine supplier types and startup scope`
  - Changed supplier detail from a generic module/industry picker to first-level supplier types: `אחזקת מבנה`, `אחזקת כלי שינוע`, and `ספק ציוד`.
  - Supplier detail activity is now contextual: transport suppliers show linked tools, facility maintenance suppliers show linked tickets, and goods suppliers show purchase orders. Clothing/goods suppliers no longer show a technicians tab.
  - Supplier cards use calmer, consistent typography and type-specific metrics.
  - Startup no longer tries to load settings-only app issue reports for executive/leadership sessions, avoiding the false `403`/save-failure noise after BI login.
  - Background shared-storage failures are diagnostic-only at the root handler; visible red save/delete toasts should come from explicit user-initiated save/delete paths.
  - Verified with full Vitest suite, static syntax check, build, release check, and live login smoke.
- `Revert fleet internal numbers` (current commit)
  - Safely reverted the separate fleet internal-number field, import support, tests, and Supabase migration at owner request.
  - Fleet identification returns to the existing code, chassis number, and license number behavior.
- `Link supplier technicians in supplier cards` (current commit)
  - Fixed supplier add flow by separating supplier creation from the search form submit path.
  - Softened supplier-card typography to match the calmer operational UI style.
  - Added a `טכנאים` tab to supplier detail, listing technician users linked through the existing `supplier` profile field.
  - Technician profiles now keep `supplier` assignment for every technician scope, while transport ticket visibility continues to use the existing `fleet.supplier` / `session.supplier` contract.
  - Verified with focused supplier/user/session/profile tests, full Vitest suite, `npm run lint`, `npm run build`, `npm run release:check`, and a targeted Playwright supplier smoke.
- `Route tickets through suppliers`
  - Changed ticket routing from direct technician assignment to supplier/contractor queue assignment.
  - Ticket creation and ticket detail now write `ticket.supplier`; `ticket.assignee` is set later only when a technician accepts the ticket.
  - Transport tickets default to the selected fleet unit supplier; facility tickets can be routed to a supplier from the admin creation/detail flow.
  - Supplier detail now has a live `תחומי ספק` picker: transport, PPE/clothing, and the existing facility maintenance categories (`facility:<categoryId>`).
  - PPE supplier selection now respects the supplier PPE/clothing scope.
  - Technicians listed inside supplier detail open the technician user card.
  - Verified with `tests/supplierTechnicianWorkflow.test.js`, `npm run build`, `npm run release:check`, and local browser smoke for supplier add/detail plus facility ticket supplier routing.
- `Complete BI period and drilldown pass`
  - Finished the BI period selector with `עכשיו`, `30 ימים`, and `90 ימים`; trend, repeat, PM, cleaning, PPE, and finance summaries now follow the selected BI window instead of fixed hardcoded labels.
  - Added explainable downtime rows under `למה זה תקוע`, showing critical transport downtime duration, likely cause, main lifecycle stage, and direct ticket drill-down.
  - Added work-record signals for tasks and meetings into BI and wired task drill-downs through the existing `מטלות` module instead of adding BI-only actions.
  - Tightened department BI scope so facility tickets tied to scoped zones are included, and tasks/meetings are scoped to department workers plus the manager.
  - Verified with focused BI scope tests, role/profile/API tests, full test suite, lint, build, release check, demo UI smoke on desktop/mobile, and a targeted mobile Playwright check for the period switch and task navigation.
- `Consolidate dashboard analytics into BI`
  - Made BI the unified first screen for `admin`, `executive`, and department managers.
  - Retired the old standalone `לוח בקרה` and `אנליטיקה` UI entry points and removed the stale dashboard widget-preference model.
  - Moved useful analytics into BI as compact drill-down/evidence panels: facility maintenance categories/zones, execution load, PM completion, cleaning compliance, PPE issue/cost/repeat signals, bottlenecks, repeat problems, department risk, and finance.
  - Kept admin command-center behavior inside BI so admin still has fast operational decision routes for tickets, transport, facility, cleaning, PPE, PM, fleet documents, ownership gaps, and SLA issues.
- `b42c808 Make department BI the manager entry point`
  - Made BI the default first screen for department managers (`user`) while admin still used the existing dashboard/control-center start at that time. Superseded by the current BI consolidation: admin now starts on BI.
  - Added manager BI drill-down routes into the existing ticket list and department modules instead of adding BI-only actions.
  - Added short trend/repeat-problem BI signals using existing ticket data.
  - Extended strict department PM scope to handle `fleetId`, `forkliftId`, and `unitId`.
  - Kept admin command BI action-oriented with explicit "next step" labels.
- `bf7fec9 Add BI department risk drilldowns`
  - Added a compact BI `אזורי סיכון` / department-risk panel.
  - Risk rows summarize open tickets, SLA breaches, critical downtime, overdue PM, cleaning issues, and PPE requests by department.
  - Rows route through existing modules: department ticket drill-downs go to the ticket list, while PM/cleaning/PPE-only rows go to their existing module flows.
  - Added `biDepartmentRiskRows()` coverage in `tests/biScopeModel.test.js`.
- `5d0a7c2 Add financial drilldown to BI`
  - Expanded the BI finance panel for `admin`/`executive`.
  - Shows 30-day closure count, average closure cost, supplier count, and top supplier costs with ticket drill-down.
- `e86738a Add BI bottleneck explanation panel`
  - Added `למה זה תקוע` to BI using existing ticket lifecycle models.
  - Shows active bottleneck stages and waiting reasons with drill-down into filtered tickets.
- `9875151 Balance admin BI command queue`
  - Balanced the admin command queue across domains so tickets/cleaning do not hide PM, documents, PPE, or other operational risks.
  - Added compact domain counters and domain/action labels to command-center rows.
- `c490f9d Keep admin command BI separate`
  - Kept the admin-only BI command center separate from the `executive` leadership BI view.
  - Added `executive` to admin role preview so leadership BI can be checked visually.
- `88708b3 Add admin command queue to BI`
  - Added the first admin command-center queue inside BI.
  - Surfaces urgent items from tickets, SLA, critical transport downtime, cleaning, PPE, PM, and fleet documents.
- `1ac382c Add PPE summary to BI`
  - Added PPE request, low-stock, and open-order summary into BI.
- `3a4bc14 Add cleaning summary to BI`
  - Added cleaning zones, open reports, missed rounds, and recent cleaning issue signals into BI.
- `d2cb8b8 Show facility tickets in BI drilldowns`
  - Ensured BI drill-downs include facility/building tickets, not only transport.
- `3defbc0 Add BI ticket drilldowns`
  - Added BI navigation into filtered ticket lists and ticket details.
- `06c92d9 Soften BI typography`
  - Reduced overly heavy typography in the new BI shell.
- `a4ba542 Add BI shell`
  - Added the first unified BI shell.
- `f999e67 Add BI scope model`
  - Added the first `biScopeForSession` data scope model and tests.
- `0832e63 Soften ticket status palette`
  - Replaced bright status-token colors with calmer brand-compatible tones.
  - Routed ticket-card SLA/risk/status/downtime badges through the muted token palette.
  - Updated `tests/statusTokenModel.test.js`.
- `c88b16e Tighten mobile dashboard cards`
  - Made mobile dashboard KPI blocks, notification card, and domain cards more compact.
  - Verified mobile dashboard at `390px` without horizontal overflow.
- `9417cef Restyle dashboard domain cards`
  - Restyled dashboard domain cards to match the newer operational dashboard language.
- `55a960c Fix worker status indicators`
  - Corrected worker card indicators: online / pending setup / last seen.
- `617e0d1 Add controlled rollout baseline`
  - Added `docs/controlled-rollout-baseline-2026-07-11.md`.
- `f480dc1 Remove dashboard KPI hover jitter`
  - Removed micro-jitter in dashboard KPI icons on hover.
- `009f48d Fix supplier cards and linked fleet rows`
  - Fixed supplier-card layout, linked fleet row behavior, and supplier add flow issues.

## Files Recently In Active Use

Primary active implementation file:

- `src/ClaudeMaintenanceApp.jsx`
  - Most UI changes are still here.
  - Do not replace this file wholesale.
  - Use precise patches only.

Shared models / tests recently touched:

- `src/statusTokenModel.js`
- `tests/statusTokenModel.test.js`
- `src/notificationPrefsModel.js`
- `tests/notificationPrefsModel.test.js`
- `src/pushNotificationModel.js`
- `public/cmms-sw.js`
- `docs/controlled-rollout-baseline-2026-07-11.md`
- `docs/active-work.md`
- `docs/handoff-for-next-codex.md`
- `tools/staging-ui-smoke.mjs`

Important docs to read before broad decisions:

- `docs/bi-contract.md`
- `docs/active-work.md`
- `docs/current-status.md`
- `docs/release-checklist.md`
- `docs/backlog.md`
- `docs/controlled-rollout-baseline-2026-07-11.md`

## What Changed In The UI Direction

The owner rejected the earlier "good enough" operational look as too old-fashioned in multiple screens.

Current visual direction:

- More premium, calm, operational SaaS.
- Brand palette:
  - main background: `#FFFFFF`
  - light section background: `#F7F8FA`
  - pearl gray: `#E6E7E9`
  - dark pearl / borders: `#C9CDD1`
  - muted text / icons: `#6F7680` and `#A4A9B0`
  - primary blue: `#1F4E8C`
  - blue hover: `#3E6DB0`
  - warm beige was tried as `#E9DFC9` and then cooled down because it looked too heavy.
- The owner wants critical blocks visually distinct, but not acidic.
- Ticket status colors should remain meaningful as "traffic-light" signals, but muted and brand-compatible.
- Hebrew RTL must be respected:
  - icons generally sit on the right side of Hebrew content;
  - alignment must be checked visually, not guessed from CSS.

Screens already touched in this design pass:

- BI shell / first unified leadership view;
- admin BI command-center queue;
- dashboard;
- mobile dashboard;
- ticket cards;
- fleet list;
- suppliers cards and linked fleet rows;
- users / worker department tree;
- dashboard domain cards;
- dashboard KPI strips;
- logo/sidebar sizing;
- notification panel direction was explored.

## BI / Analytics Direction

The owner confirmed that the existing Analytics module contains useful content,
but BI must not become a crowded analytics report.

Current agreed principle:

- BI top level is a compact decision map.
- Analytics is the evidence and investigation layer underneath BI.
- BI should show the decision signal, cause, operational owner, and route to the
  existing workflow.
- Detailed analytics should be reached by drill-down from the relevant BI signal.
- Old standalone Dashboard/Analytics screens should not be reintroduced unless a
  specific owner-approved product decision reverses this consolidation.

Good candidates for BI first-screen signals:

- SLA breaches and urgent open tickets;
- repeated problems by fleet unit, facility asset, zone, or category;
- downtime causes / waiting owner / time by stage;
- top risk departments or areas;
- PM, fleet document, cleaning, and PPE health;
- finance only for `admin` / `executive`.

Keep out of the first BI screen unless it becomes an active risk:

- long tables;
- export/report-only blocks;
- empty "no data" sections;
- full historical report views;
- secondary comparisons that do not change a current decision.

Useful Analytics blocks should migrate into BI as drill-downs:

- facility maintenance by category;
- repeat issues by area/asset/category;
- downtime and time-by-status;
- supplier/category/asset cost breakdowns;
- technician load;
- PM planned versus completed;
- cleaning compliance and complaint density;
- PPE issue/cost/repeat usage.

## What Was Tried And Rejected / Needs Caution

- A notification panel that opened as a floating overlay over the side menu was rejected by the owner as visually wrong.
  - Current direction: desktop notifications open as an integrated side tray next to the sidebar, without dimming or covering the menu. If continuing the work, keep that relationship instead of returning to a centered modal.
- The warm beige `#E9DFC9` as a large dashboard band felt too heavy. Cooler neutral/warm hybrids worked better.
- The owner repeatedly caught RTL icon/text direction mistakes. Do not assume LTR layout habits.
- The owner disliked overly large mobile blocks. Mobile dashboard cards must be compact, not desktop cards stacked vertically.
- The owner disliked bright red/orange/blue pills in tickets. Use muted semantic token colors.
- Broad "let's split the monolith now" remains explicitly not the current next step.

## Known Issues / Watch List

Visual polish still likely needed:

- Some screens may still carry older bold/heavy typography or old-style controls:
  - settings;
  - cleaning;
  - analytics;
  - supplier detail;
  - PPE sub-tabs;
  - tasks / meetings;
  - remaining fleet detail areas.
- Mobile should be rechecked after every visual change.
- iPhone Safari/PWA icon caching was reported by the owner after reinstalling the app. If it recurs, inspect manifest/icon files and service-worker cache behavior.
- App issue log (`דיווחי בעיות במערכת`) should be checked periodically; keep useful reports, clear obvious stale/noise only when safe.
- Push/browser notifications:
  - Panel is the complete operational list.
  - OS/browser push should stay narrow and interrupt only for actionable events.
  - Read state should be per user, not global.

Technical/performance watch:

- Main bundle still triggers Vite's raw-size warning. Latest local build after the fleet/PM lazy split produced the main app chunk at about 906.85 kB raw / 227.65 kB gzip, plus separate lazy screen chunks and stable vendor chunks.
- Next meaningful performance work should continue reducing initial JS and defer post-login work where safe, not start from visual rewrites.
- Live controlled-rollout baseline exists, but headless Chromium does not prove native iOS/Safari push-banner behavior.

## Validation Expectations

For code/UI changes:

- `npm run lint`
- `npm run build`
- focused tests for touched models, when applicable
- browser smoke on the changed screen
- mobile viewport check when UI changes affect dashboard/cards/lists/forms

Useful browser checks:

- no horizontal overflow;
- console errors/warnings are absent or understood;
- touched buttons remain at least mobile-usable;
- Hebrew RTL icon/text order looks intentional;
- live Vercel may lag GitHub by a few minutes after push.

For docs-only changes:

- `git diff --check`
- `npm run release:check` is enough when no app code changed.

## What Not To Do

- Do not touch v2 or Claude branches.
- Do not start using `src/app`, `src/features`, or `src/shared` as a new v1 modular architecture.
- Do not rebuild the app shell or router.
- Do not replace `src/ClaudeMaintenanceApp.jsx` wholesale.
- Do not manually edit production/staging database data or overwrite owner-entered staging data without explicit permission.
- Do not recreate retired KV mirrors or old experimental directions from archive docs.
- Do not make broad UI changes without checking the live screen in a browser.

## Recommended Next Steps

1. Treat the current BI consolidation as the accepted v1 shell unless the owner
   reports a concrete problem from live use. Do not reintroduce standalone
   Dashboard/Analytics screens.
2. If BI grows again, keep additions compact and evidence-led:
   - add only active risk signals;
   - route to existing workflows;
   - keep financial details limited to `admin` / `executive`;
   - preserve strict department scope for `user`.
3. Separately investigate live user-role save failures if they recur. The local
   `executive` role foundation, API mapping, Supabase profile whitelist,
   migration, and tests are present, so a live failure is likely deploy/schema/API
   state and should be debugged as a focused production/staging issue.
4. Continue the same design-system polish on remaining old-looking screens:
   - settings first;
   - cleaning;
   - PPE;
   - suppliers/fleet details.
5. Revisit notifications UI as an integrated side drawer, not as a centered modal.
6. Do a small manifest/PWA icon cache check if the old iPhone app icon still appears after deploy.
7. When UI dust settles, run a broader smoke:
   - `npm run release:check`
   - `npm run build`
   - existing demo UI smoke if available
   - optional live staging smoke only if credentials/environment are ready and the owner expects live verification.
8. Later: create a separate performance slice for code splitting / initial JS reduction.
