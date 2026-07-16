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
