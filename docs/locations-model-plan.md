# Locations Model Plan

This document defines the safe path from today's two zone models to one shared object-based location model.

It is intentionally a plan, not a migration. Do not change cleaning rounds, QR links, or production/staging data from this document alone.

## Current State

The app currently has two different location concepts:

- `config.zones`: string names used by maintenance tickets, fleet/facility reports, and maintenance settings.
- `czone:*` / `cleaning_zones`: object records used by cleaning. These include `id`, `name`, `building`, `floor`, `windows`, per-window checklist selection, cleaner assignment, manager visibility, active days, QR/public reporting, and compliance logic.

Both are useful, but they are not the same model. Adding `בקרות` on top of either one directly would create a third location universe or force controls to inherit cleaning-specific fields.

## Target Shape

Use a shared object record named `location`.

Expected base fields:

- `id`
- `name`
- `type`
- `building`
- `floor`
- `area`
- `parentId`
- `active`
- `tags`
- `createdAt`
- `updatedAt`

Recommended location types:

- `warehouse`
- `yard`
- `office`
- `canteen`
- `dock`
- `parking`
- `machine_area`
- `safety_point`
- `general`

The base model should describe where something is. It should not include process-specific rules such as cleaning windows or inspection schedules.

## Cleaning Profile

Cleaning-specific behavior should live in a profile/extension linked to a shared location.

Suggested shape:

```js
{
  locationId,
  checklist,
  windows,
  activeDays,
  cleanerId,
  cleanerName,
  managerIds,
  qrCode,
  compliancePolicy
}
```

This preserves the current cleaning complexity without forcing every future module to understand cleaning windows.

## Controls Usage

Controls should reference `locationId` on targets, assignments, runs, and findings.

Controls should not create another free-text zone list. If a control target is a place, it should eventually point to `locationId`. If the target is a vehicle, user, supplier, order, process, or department, it should use its own structured target type.

For the first controls slice, it is acceptable to:

- create/use `location` records for controls targets;
- keep cleaning on `czone:*`;
- keep maintenance tickets using legacy `zone` strings;
- store a display fallback like `locationText` only as compatibility/readability.

It is not acceptable to:

- duplicate cleaning windows into controls;
- make controls depend on `czone:*` internals;
- rename/delete owner-entered cleaning zones during early controls work;
- convert all ticket `zone` strings in the same PR as introducing controls.

## Migration Boundary

Migration should happen in phases.

### Phase 1: Model And Adapters

Add a model/helper layer that can normalize:

- a legacy string zone into a location-like draft;
- a cleaning zone object into a base location plus cleaning profile;
- a base location into display text for old screens.

No data writes are required in this phase.

### Phase 2: New Controls Use `locationId`

New controls records should reference `locationId` from the start.

If a needed location does not exist yet, the controls UI can create a base location record, but it must not edit cleaning-specific fields unless the user is in a cleaning/location management flow.

### Phase 3: Maintenance Zones

Move maintenance settings from string-only `config.zones` toward object locations.

Existing tickets can keep their string `zone` for history. New tickets may store both:

- `locationId`
- `zone` or `locationText` as a display snapshot

Backfill is optional and should be a separate explicit PR only if reporting needs it.

### Phase 4: Cleaning Convergence

Only after controls and maintenance can read base locations safely, map `czone:*` records to shared `location` records.

Cleaning execution remains driven by the cleaning profile. Existing `cround:*` and `ccomplaint:*` records should continue to resolve by their current `zoneId` until a dedicated migration proves compatibility.

## Open Decisions Before Code Migration

- Storage key/table for base locations: new `location:*` KV prefix and future `locations` table, or compatibility through existing `czone:*` until normalized tables arrive.
- Whether maintenance string zones should auto-create inactive/base locations or remain manual.
- Who can manage base locations versus cleaning profiles.
- Whether departments should have default/owned locations.
- How to handle duplicate names such as "מחסן ראשי" across buildings/floors.

## Recommended First PR

Create a pure model/test PR:

- `src/locationModel.js`
- tests for normalizing string zones, cleaning zones, and base locations
- no persistence changes
- no UI changes
- no migration/backfill

That gives future controls work a stable language without risking the current cleaning system.
