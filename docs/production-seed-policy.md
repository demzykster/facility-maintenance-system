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
- Demo seed loading is disabled.
- Built-in demo identities are disabled.
- The first administrator is a server/bootstrap responsibility.
- No production admin password, PIN, or reset secret may be hardcoded in the frontend bundle.
- The first admin must be forced through a credential-change/bootstrap-completion flow when real Auth is implemented.

## Current Implementation

- `src/seedPolicyModel.js` owns the app-mode seed policy.
- Default mode is `demo`, so existing local/demo behavior stays unchanged.
- `VITE_CMMS_APP_MODE=production` disables demo data loading and built-in demo identities in the frontend.

## Release Meaning

This is not full production Auth yet. It is a boundary guard:

- demo behavior remains explicit;
- production behavior cannot accidentally ship with demo users;
- the later Auth/RLS/server implementation has a clear bootstrap contract.
