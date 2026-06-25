# SLA / Stage Timing Model

This document defines the next safe direction for ticket SLA and stage timing. It exists to prevent scattered fixes that make reports, dashboards, and exports disagree.

## Current State

- Each ticket has one overall `dueAt` deadline.
- The UI shows SLA breach based on the overall deadline.
- Ticket saving already accumulates stage duration into `statusMs`.
- Waiting reasons are stored as stage keys such as `waiting:parts`.
- Exports already use `ticketLifecycleSummary()` and `ticketLifecycleRows()` to show historical status/wait durations.
- Some waiting reasons have `pauseSla`, but the business meaning is still unclear to users.

## Problem

One global SLA number is not enough for CMMS decisions.

Example:

1. A manager opens a transport ticket.
2. The unit waits before a technician receives it.
3. A technician starts work.
4. The ticket waits for parts, approval, budget, outside supplier, or unit transfer.
5. The unit may be returned to service while the ticket continues.
6. The requester may return the ticket for rework.
7. The ticket is closed with a closure quality reason.

If analytics only shows one total SLA breach, it cannot explain where time was lost or who needed to act.

## Target Concept

Every meaningful ticket stage should answer:

- What stage is the ticket in?
- Who owns the next action?
- When did the stage start?
- How long did the stage last?
- Should this stage count against operational SLA?
- Should this stage count as downtime?
- Should this stage appear in dashboard/analytics/export?

## Stage Timing Rules

- Keep `statusSince` as the current-stage start timestamp.
- Keep `statusMs` as the accumulated historical duration map.
- Continue using stage keys:
  - plain status: `new`, `in_progress`, `pending_user`, `pending_admin`, `done`;
  - waiting stage: `waiting:<reasonId>`.
- Do not add another parallel timing store unless the existing shape cannot support the needed report.
- Do not remove historical timing when a ticket is closed.
- Closed tickets may have no current waiting reason, but must keep historical waiting durations.

## SLA Interpretation

There are two different concepts:

- Overall ticket SLA: target completion deadline for the whole ticket.
- Stage SLA / stage duration: how long each stage waited or stayed with a responsible party.

Next implementation should not simply "stop the SLA" globally. Instead:

- `pauseSla` should be renamed or explained as "does not count against operational SLA" only if that remains the desired business meaning.
- Analytics should show both total ticket duration and stage breakdown.
- Waiting reasons should show owner and duration, not only count.

## Dashboard / Analytics Direction

Dashboard and analytics should be clickable:

- stage counters should drill into filtered ticket lists;
- waiting reason counters should drill into `קריאות` filtered by status/wait reason;
- long-stage alerts should open the exact affected ticket list;
- exports should remain the detailed audit trail, not the only way to understand timing.

## Safe First Code Steps

1. Add a pure helper that converts a ticket into normalized lifecycle stages.
2. Use that helper in both export and dashboard/analytics.
3. Add tests for:
   - open current stage duration;
   - closed ticket historical waiting;
   - waiting reason stage key;
   - equipment wait stage;
   - returned/rework stage.
4. Only after the helper is stable, change UI labels/settings around SLA.

## Explicit Non-Goals For This Phase

- No database migration.
- No Supabase/Auth/RLS work.
- No broad modular split.
- No rewrite of `ClaudeMaintenanceApp.jsx`.
- No separate backend SLA engine yet.
