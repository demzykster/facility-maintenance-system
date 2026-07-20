# System Errors And User Feedback Review - 2026-07-20

Production baseline:

- Repo: `/Users/Vadim/Documents/CMMS`
- Branch: `main`
- HEAD/origin: `ae2abb447664ffdc967f09fe1b0501d62fcf8057`
- Live version: `ae2abb4`
- Mode: read-only production audit

No app records, Supabase data, env, permissions, code, tickets, or issue statuses were changed during this review.

## Data Sources

| Source | UI | Code | API | Storage | Status Fields | Notes |
|---|---|---|---|---|---|---|
| User app reports | Settings -> `דיווחי בעיות` -> user reports | `src/AppIssuesSettings.jsx`, `src/appIssueModel.js` | `/api/settings/records?resource=appIssues` | `public.app_issue_reports` | `open`, `reviewing`, `resolved`, response fields | Manual reports are distinguishable from automatic storage failures by `legacy_payload.source`. |
| Automatic app issue reports | Same user-report list | `src/ClaudeMaintenanceApp.jsx`, settings records authority models | `/api/settings/records?resource=appIssues` | `public.app_issue_reports` | Same | Mostly normalized load/save/delete failures, grouped by kind/source. |
| System/client errors | Settings -> `דיווחי בעיות` -> system errors | `src/AppIssuesSettings.jsx`, `server/clientErrors/handler.js`, `server/systemErrors/handler.js` | `/api/client-errors`, `/api/system-errors` | `public.audit_events` with `action=client_error` | No workflow status | UI groups similar signatures. |
| AI diagnostics | Settings -> `דיווחי בעיות` -> AI diagnostics | `src/AppIssuesSettings.jsx`, `server/systemErrors/handler.js`, `server/ai/assistHandler.js` | `/api/system-errors?type=ai-assist` | `public.audit_events` with `action=ai_assist` | No workflow status | Stores safe telemetry only, not raw chat/provider prompts. |
| Cleaning/public complaints | Cleaning/public QR complaint flows | `server/public/complaintsHandler.js`, `server/cleaning/recordsHandler.js` | `/api/public/complaints`, `/api/cleaning/records?resource=complaints` | `public.cleaning_complaints` | complaint lifecycle fields | Production count was `0`; not a current app-feedback backlog source. |

## Executive Summary

- `public.app_issue_reports` contains `452` records: `447` automatic storage/normalized API failure reports and `5` manual owner reports.
- All visible app issue groups are currently `open`; this audit did not mark any as reviewed/resolved.
- The five manual owner reports are product/UX items, not inline-AI regressions.
- In the checked read-only sample, no repeated automatic app-issue group was found after the deployed `ae2abb4` build; monitoring remains necessary.
- `public.cleaning_complaints` is empty, so there is no public cleaning complaint backlog to triage here.
- Current post-deploy runtime evidence shows one likely low-risk cleanup/logging issue around ticket file deletion `404`, not a ticket data-loss issue.

## Current Production Bugs

| Ref | Severity | Area | Evidence | Impact | Recommended action |
|---|---|---|---|---|---|
| `ai-mrt7z7g...` | P2/P3 | BI heatmap | Manual owner report: visual problem in `מפת חום`, specifically `תחום`; code path is `src/BIHeatmapPanel.jsx` and responsive CSS in `src/ClaudeMaintenanceApp.jsx`. | Owner-visible visual/RTL defect; exact reproduction is incomplete. | Focused UI reproduction/fix goal with screenshot/viewport and desktop/mobile Playwright check. |
| Runtime file delete `404` after ticket cleanup | P3 | Ticket delete / file cleanup | Vercel logs after `ae2abb4` show ticket delete succeeded, KV photo deletes succeeded, then `/api/files` returned `404` for related cleanup. Ticket row was gone; audit recorded delete. | Noise and possible confusing error logging during cleanup; no evidence of orphan business ticket or data loss. | Make file cleanup idempotent or route legacy photo keys correctly; do not treat missing metadata as critical when business delete already succeeded. |

## Product Requests

| Ref | Area | Request | Scope | Notes |
|---|---|---|---|---|
| `ai-mrt8gya...` | Cleaning/history/admin tools | Add per-day and full clear-history controls for problems, rounds, photos, and related data. | Large | Destructive/retention-sensitive. Needs exact data boundaries, audit policy, backup expectations, and role gating before implementation. |
| `ai-mrt8dpc...` | Facility suppliers/waiting | Remove generic `שיוך ספק / קבלן`; make `ממתינה לספק` capture the awaited supplier and show only building-related suppliers. | Medium/Large | Aligns with current facility supplier routing model but needs supplier taxonomy and wait-reason UX design. |
| `ai-mrt88mz...` | Waiting/SLA scheduling | Add a date-based waiting/action flow where SLA is tied to the assigned date; verify it does not conflict with `סיבות המתנה`. | Medium/Large | Requires lifecycle/SLA semantics decision: pause, resume, due-date override, or separate planned action date. |
| `ai-mrt81yj...` | Transport suppliers | Supplier detail should show count/list of related tickets, similar to orders, with open navigation. | Medium | `supplierActivityCounts` already counts tickets; UI likely needs related-ticket list/drill-down. |

## Already Fixed Or Historical

| Signal | Evidence | Status |
|---|---|---|
| Transport asset `210` not found in inline AI | Fixed by recent inline AI asset/context work before `ae2abb4`; owner later confirmed transport ticket creation worked. | Fixed; keep as regression coverage. |
| Facility inline follow-up and location clarification regressions | Fixed by `Fix inline AI intake follow-up state`, `Bound inline AI ticket intake latency`, and `Improve inline AI location clarification`; live version is `ae2abb4`. | Fixed; manual owner smoke confirmed current stage. |
| Automatic cleaning normalized load failures (`permission_required:cleaning:view`) | Large duplicate groups existed before `ae2abb4`; in the checked sample no post-`ae2abb4` recurrence was found and current API logs showed normal `200` reads. | Historical/stale unless it reappears; monitoring remains necessary. |
| `client_error storage_save_failed set` | Last observed before the current inline-AI rollout period. | Historical/stale. |
| `ticket_normalized_save_failed` permission errors | Older role/scope failures; no evidence of recurrence after current deployed SHA in this audit. | Monitor only. |

## Duplicates And Noise

- The `447` automatic `app_issue_reports` are dominated by repeated normalized load failures. Treat them as grouped signatures, not 447 independent product bugs.
- The post-delete `/api/files` `404` is useful as a cleanup bug signal, but duplicate instances around the same ticket lifecycle should be grouped under one issue.
- AI diagnostics are safe telemetry; old `missing zone` or draft-ticket records before `ae2abb4` should not be counted as current bugs without a fresh reproduction.

## Needs Clarification

| Topic | One question to owner |
|---|---|
| Heatmap visual bug | On which viewport/screen state does `תחום` move or break, and can you attach the screenshot from the report? |
| Clear history buttons | Which exact records may be deleted or archived: cleaning rounds, complaints, photos, app issues, audit, tickets, or only temporary cleaning history? |
| Facility supplier waiting | Should supplier waiting be a required field only for `ממתינה לספק`, and should it be limited by category, zone, or global building supplier type? |
| Scheduled waiting/SLA date | Should SLA be paused until the selected date, reset to that date, or tracked as a separate planned-action date while original SLA remains auditable? |
| Transport supplier tickets list | Should the supplier page show all historical tickets or only open/active tickets by default? |

## Recommended Goal Order

1. Fix/reproduce BI heatmap visual bug, because it is a current owner-visible UI issue and likely scoped.
2. Make ticket file cleanup idempotent around already-deleted/metadata-missing files, because it is current log noise after successful ticket lifecycle actions.
3. Add transport supplier related-ticket list/counter UI.
4. Design facility supplier waiting flow and supplier filtering.
5. Design date-based waiting/SLA semantics.
6. Design destructive clear-history controls only after retention, audit, backup, and permission rules are explicit.

## Safety Notes

- No live issue statuses were changed.
- No records were deleted or archived.
- No Supabase schema/data/env/permission changes were made.
- No production ticket write-smoke was performed.
- No secrets, tokens, or session data were included in this document.
