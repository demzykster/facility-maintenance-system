# CMMS Master Context

## Scope

This repository snapshot is the current v1 CMMS system. The release focus is stabilization and small, low-risk improvements.

Do not use this file as permission to start broad architecture work. Read the current code and `docs/active-work.md` before changing behavior.

## Current Product Areas

- Tickets and lifecycle.
- Fleet records, drivers, documents, transport tickets, and periodic maintenance.
- Cleaning zones, rounds, complaints, absences, and public QR reporting.
- PPE catalog, issue flow, worker requests, stock, orders, and norms.
- Tasks and meetings.
- Users, worker access, groups, permissions, suppliers, settings, audit, production login, backup/restore.

## Retired Direction

The previous separate checks direction was removed from the v1 product surface and runtime contracts. Do not treat removed files, prefixes, or deleted docs as a backlog to resume.

## Source Layout

The current v1 app remains in the existing source layout. Do not create `src/app`, `src/features`, or `src/shared` in this workstream.

## Data Collections

The production collection map lives in `src/dataCollections.js` and is the source for backup/export coverage.

Current collection families:

- users
- fleet
- tickets
- periodic maintenance
- technician presence
- cleaning zones, rounds, complaints, absences
- locations
- tasks
- meetings
- PPE movements, items, norms, requests, orders
- app issue reports

## Guardrails

- Work from current `main` unless the owner explicitly asks otherwise.
- Do not touch v2 or Claude branches.
- Keep docs honest after merges.
- Prefer small verified changes over broad redesign.
