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
