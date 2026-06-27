# Production Audit Events

Production CMMS must keep a durable record of important changes.

The source of truth for the first audit contract is `src/auditEventModel.js`.

## Why This Exists

UI history and visible logs are not enough for production.

Production needs to answer:

- who changed a ticket status;
- who changed permissions;
- who changed settings;
- who uploaded or deleted a file;
- what the value was before and after the change;
- when the change happened.

This is especially important before moving more writes behind server APIs and Supabase RLS.

## Future Table

Future normalized table: `audit_events`.

Initial fields:

| Field | Meaning |
|---|---|
| `id` | Stable audit event id |
| `at` | Event timestamp |
| `actor_id` | CMMS app user id or system actor |
| `actor_name` | Display name at event time |
| `actor_role` | Role at event time |
| `entity_type` | Affected entity family, such as `ticket`, `permission`, `settings`, or `file` |
| `entity_id` | Affected entity id |
| `action` | Action type, such as `status_change`, `permission_change`, `upload`, or `update` |
| `summary` | Short human-readable summary |
| `before` | Structured previous value snapshot |
| `after` | Structured new value snapshot |
| `metadata` | Extra queryable context |

## Current Scope

This is a contract/model step only.

The next production step is to write these events server-side for sensitive changes, starting with permissions, settings, ticket lifecycle/status changes, and file upload/delete events.
