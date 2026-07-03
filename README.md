# CMMS CDSL

React/Vite CMMS for CDSL maintenance, fleet, PPE, suppliers, tasks, and operational dashboards.

## Requirements

- Node.js 20 or newer
- npm

## Local Run

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

## Production Build

```powershell
npm run build
```

The build output is written to `dist/`.

## Login / Data Mode

Local/demo mode can still use built-in demo identities for development review.

The deployed staging/pilot app uses the server session path backed by Supabase Auth/app profiles and the current Supabase KV compatibility bridge. Owner-entered staging data is working data; do not clear, reseed, or overwrite it unless the owner explicitly asks.

## Project Continuity

For handoff to another PC, Codex session, or Claude session, start with:

- [Active work ledger](docs/active-work.md)
- [Current status](docs/current-status.md)
- [Next steps](docs/next-steps.md)
- [Collaboration model](docs/collaboration-model.md)
- [Handoff for next Codex session](docs/handoff-for-next-codex.md)
