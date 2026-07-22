# Monolith Growth Exceptions

`src/ClaudeMaintenanceApp.jsx` baseline for the project harness:

- Lines: 9957
- SHA-256: `c615cd638bda0e4f89f50e646ed94c8576f6aa5ea4edb50c26b4004bd5c2494c`
- Recorded: 2026-07-14

The harness check fails if the file grows beyond this line count unless the current goal records an exception below.

Each exception must include:

- date;
- owner goal;
- new line count;
- why the growth was necessary;
- why extraction was not the right move for that goal;
- follow-up/removal condition.

## Exceptions

- Date: 2026-07-14
- Owner goal: capability-based AI ticket.create vertical slice.
- New line count: 9962.
- Why necessary: minimal shell wiring imports the extracted ticket create contract, sends an idempotency key to the server AI boundary, accepts authoritative normalized ticket create results, and stops browser-local ticket numbering in normalized/API-backed mode.
- Why extraction was not the right move: the new business logic lives in `src/ticketCreateContract.js`, `server/tickets/ticketCreateDomain.js`, and `server/ai/capabilities/`; the shell remains the existing composition point for form submit and API adapter wiring.
- Follow-up/removal condition: when ticket form/create UI is extracted into its own vertical module, move these wiring lines with that module and reduce the shell back toward the baseline.

- Date: 2026-07-14
- Owner goal: transport card white-screen hotfix after fleet extraction.
- New line count: 9963.
- Why necessary: manager department fleet cards still opened the extracted `FleetCard` directly from the shell; one additional lazy component binding is needed so manager transport detail opens through `FleetAssetsModule.jsx` without restoring the detail implementation to the monolith.
- Why extraction was not the right move: the detail implementation is already extracted; this hotfix only reconnects the existing manager shell trigger to that extracted module.
- Follow-up/removal condition: when the manager fleet department view is moved into `FleetAssetsModule.jsx`, remove this shell lazy binding and reduce `src/ClaudeMaintenanceApp.jsx` below this exception.

- Date: 2026-07-15
- Owner goal: PM schedule white-screen hotfix after fleet extraction.
- New line count: 9965.
- Why necessary: role shell surfaces for manager and technician still rendered extracted PM schedule/detail components by their old local names, while the admin PM module already used the lazy fleet module. Two lazy bindings reconnect those shell entrypoints to `FleetAssetsModule.jsx` and prevent `PMSchedule is not defined` / `PMEntry is not defined` white screens without moving PM implementation back into the shell.
- Why extraction was not the right move: the PM implementation is already extracted; this hotfix only reconnects remaining role-shell triggers to the extracted module and passes the existing `fleetAssetsUi()` dependency bundle.
- Follow-up/removal condition: when manager and technician PM surfaces move fully into `FleetAssetsModule.jsx` or another role module, remove these shell lazy bindings and reduce `src/ClaudeMaintenanceApp.jsx` below this exception.

- Date: 2026-07-16
- Owner goal: transport ticket supplier responsibility hotfix.
- New line count: 9969.
- Why necessary: transport ticket responsibility is still rendered and routed through shell-local `TicketCard`, `TechApp`, notification fanout, and `saveTicket`; those seams must call the extracted `ticketResponsibilityModel` so new supplier-routed transport tickets do not become assigned to the opener and legacy opener/supplier-assigned tickets stay visible to supplier technicians.
- Why extraction was not the right move: the ownership rules were extracted into `src/ticketResponsibilityModel.js`; moving `TicketCard`, `TechApp`, and ticket notification fanout out of the shell would be a larger vertical extraction than this live hotfix.
- Follow-up/removal condition: when ticket card/list surfaces and ticket save/notification wiring move into a ticket module, remove these shell calls and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-16
- Owner goal: mobile ticket card readability and transport icon hotfix.
- New line count: 9970.
- Why necessary: the shared ticket card still lives in `src/ClaudeMaintenanceApp.jsx`; this live UI hotfix must adjust its metadata text, long-label truncation, and compact chip row so mobile ticket lists do not overflow or become vertically ragged, and transport cards show the fleet unit instead of a generic track label.
- Why extraction was not the right move: extracting all ticket list/card surfaces would be a larger vertical slice than this production-facing readability fix, and the change reduces the shell line count below the previous exception while touching only the existing card seam.
- Follow-up/removal condition: when ticket card/list surfaces move into a ticket module, move this metadata formatting and wrapping rule with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-20
- Owner goal: unified inline AI ticket creation for transport and facility intake.
- New line count: 10015.
- Why necessary: the existing new-ticket type picker and AI API adapter wiring still live in `src/ClaudeMaintenanceApp.jsx`; the shell needs minimal wiring to mount the extracted inline AI intake and pass its idempotency key, abort signal, and bounded request timeout to the server AI boundary so UI replay protection and latency handling use the same server-owned create contract.
- Why extraction was not the right move: the intake orchestration, transient request state, capability validation, and compact UI live outside the shell in `src/inlineAiTicketIntakeOrchestrator.js`, `src/InlineAITicketCreate.jsx`, `src/useInlineAITicketSession.js`, `src/inlineAiTicketCreateModel.js`, and `server/ai/capabilities/`; extracting the whole ticket form/modal would be a larger ticket-module vertical slice than this focused correction.
- Follow-up/removal condition: when the ticket create modal/form is extracted into a ticket module, move this inline AI mount and API adapter wiring with it and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-20
- Owner goal: inline AI location clarification for facility intake.
- New line count: 10018.
- Why necessary: the compact inline AI component now renders server-offered location choices as small RTL chips, and the existing shell stylesheet is still where inline modal styles are hosted.
- Why extraction was not the right move: the clarification state, candidate resolution, and choice handling live in extracted inline AI modules; this exception only covers three shell CSS rules for the already-mounted component.
- Follow-up/removal condition: when the ticket create modal/form styles move into a ticket module, move these chip styles with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-20
- Owner goal: BI heatmap mobile RTL layout fix.
- New line count: 10023.
- Why necessary: the heatmap layout styles still live in the shell stylesheet; the fix needs a small set of RTL/mobile CSS constraints so the `תחום` column remains aligned with rows, long labels and risk tags stay compact, and the heatmap does not add external horizontal overflow.
- Why extraction was not the right move: BI heatmap rendering and data preparation are already outside the shell in `src/BIHeatmapPanel.jsx`, `src/BIOverview.jsx`, and `src/biScopeModel.js`; moving the stylesheet out would be a broader styling extraction than this owner-reported visual bug.
- Follow-up/removal condition: when BI styles move into a BI module stylesheet or CSS slice, move these heatmap rules with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-21
- Owner goal: BI heatmap Safari RTL chips layout.
- New line count: 10020.
- Why necessary: the heatmap `תחום` cell still uses shell-hosted styles, and the owner-reported Chrome/Safari regression required a bounded card layout so title, risk tags, and the AI chip no longer collapse into one compressed RTL row.
- Why extraction was not the right move: BI rendering and smoke coverage remain in extracted BI files and tooling; moving the shared shell stylesheet into a BI CSS slice would be broader than this browser compatibility fix.
- Follow-up/removal condition: when BI styles move into a BI module stylesheet or CSS slice, move these heatmap domain-cell rules with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-21
- Owner goal: Ogen safe visual refinement for public entry screen, ticket cards, and responsive UI.
- New line count: 10026.
- Why necessary: the public entry shell, QR scanner overlay, and shared ticket-card presentation styles still live in `src/ClaudeMaintenanceApp.jsx`; this goal adds a local warehouse visual, responsive/safe-area constraints, focus/alert affordances, and compact card presentation without changing auth, scanner, ticket semantics, SLA, or workflow behavior.
- Why extraction was not the right move: extracting the login/public-report surface or the shared ticket card would be a broader vertical-slice task than this bounded visual refinement; the goal intentionally leaves existing data contracts, handlers, semantic helpers, and API calls in place.
- Follow-up/removal condition: when public entry, public cleaning report, and ticket-card surfaces move into dedicated modules/stylesheets, move these presentation rules with those modules and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-21
- Owner goal: language picker and public entry warehouse visual refinement.
- New line count: 10025.
- Why necessary: the compact public-entry language control and language-direction split-layout rules are still shell-hosted beside the existing login/public cleaning scanner presentation; this bounded UI correction keeps the list of languages behind a globe trigger and flips the visual panel by text direction without touching authentication, scanner behavior, branding data, or ticket workflow.
- Why extraction was not the right move: extracting the public entry screen would be broader than this owner-requested presentation correction, and the change reuses the existing language model, brand model, and shell stylesheet.
- Follow-up/removal condition: when the public entry screen moves into a dedicated module/stylesheet, move this language picker and split-layout presentation with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-21
- Owner goal: public login remember-default simplification.
- New line count: 10024.
- Why necessary: the public login shell still owns the identifier form and production-auth remember option; this owner-requested simplification removes the visible remember-device checkbox while preserving the existing remembered-login behavior as the default.
- Why extraction was not the right move: extracting the public login form would be broader than this focused UI/auth-preference correction, and the change leaves existing login APIs, session storage adapter, and production auth store contracts intact.
- Follow-up/removal condition: when the public login form moves into a dedicated module, move this default remember behavior with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-22
- Owner goal: narrowly scoped ticket priority edit action.
- New line count: 10073.
- Why necessary: ticket detail still receives save callbacks and shell state from `src/ClaudeMaintenanceApp.jsx`; the shell needs a small dedicated `updateTicketPriority` wiring path so the extracted priority update model and normalized ticket API can update only priority, SLA target, and history without routing through generic ticket save behavior.
- Why extraction was not the right move: the validation and SLA recalculation logic lives in `src/ticketPriorityUpdateModel.js` and the server guard lives in `server/tickets/handler.js`; extracting the whole ticket detail/save surface would be broader than this bounded priority-edit task.
- Follow-up/removal condition: when ticket detail and ticket save orchestration move into a dedicated ticket module, move this callback wiring and badge focus styling with that module and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.

- Date: 2026-07-22
- Owner goal: transport create severity and priority synchronization.
- New line count: 10071.
- Why necessary: the transport create form still lives in `src/ClaudeMaintenanceApp.jsx`; this hotfix must route the existing `מצב הכלי` selector through the shared create contract and derive internal priority from the selected transport severity while removing the generic priority selector from transport-only creation.
- Why extraction was not the right move: the shared domain logic was moved into `src/ticketCreateContract.js`, while extracting the full ticket create modal would be broader than this owner-reported transport form and AI intake bug.
- Follow-up/removal condition: when the ticket create modal/form moves into a dedicated ticket module, move this transport severity wiring with it and reduce `src/ClaudeMaintenanceApp.jsx` back toward the baseline.
