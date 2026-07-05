# Production Seed Policy

This document defines how CMMS CDSL starts in demo mode versus production mode.

## Rule

Production must not depend on demo seed data or frontend hardcoded credentials.

## Modes

### Demo

- Demo data can be loaded from the UI.
- Built-in demo identities can be used on the login screen.
- This keeps the local/Vercel demo useful for review and training.

### Production

- The system starts empty of business data.
- Current local/demo users, tickets, fleet units, PPE records, cleaning records, suppliers, and history are fake data and must not be migrated into production.
- Demo seed loading is disabled.
- Built-in demo identities are disabled.
- The first administrator is a server/bootstrap responsibility.
- No production admin password, PIN, or reset secret may be hardcoded in the frontend bundle.
- The first admin must be forced through a credential-change/bootstrap-completion flow when real Auth is implemented.
- The current bootstrap endpoint is `POST /api/bootstrap/admin`; it must stay disabled unless a one-time server bootstrap is being performed.
- Real business data is entered through the app UI or through explicit imports using owner-provided source files.

## Current Implementation

- `src/seedPolicyModel.js` owns the app-mode seed policy.
- Default mode is `demo`, so existing local/demo behavior stays unchanged.
- `VITE_CMMS_APP_MODE=production` disables demo data loading and built-in demo identities in the frontend.
- `api/bootstrap/admin.js` defines the server-only first-admin bootstrap endpoint contract.

## Release Meaning

This is not full production Auth yet. It is a boundary guard:

- demo behavior remains explicit;
- production behavior cannot accidentally ship with demo users;
- the Auth/RLS/server implementation has a clear bootstrap contract.
- current demo/localStorage data is not treated as a migration source.
