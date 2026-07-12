# Production AI Boundary

Current demo/local AI helpers can use browser-side fallback behavior. The old direct browser call to the AI provider must not be used in production.

## Production Rule

Production AI has two safe modes:

```env
CMMS_AI_MODE=disabled
```

or:

```env
CMMS_AI_MODE=server
CMMS_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

or:

```env
CMMS_AI_MODE=server
CMMS_AI_PROVIDER=openai
OPENAI_API_KEY=...
CMMS_AI_MODEL=gpt-5.2
```

`client` mode is forbidden in production because provider secrets, rate limiting, audit, and data filtering must live on the server side.

## Current State

- Production defaults to disabled AI when no AI mode is configured.
- Browser AI buttons are hidden unless the frontend AI mode is `client`.
- Demo/local can still use the existing browser AI path and local keyword fallback.
- The current `עוזר AI` panel and AI analysis helpers are not a production assistant yet. They are demo/client-side traces around the existing UI and should not be presented as a reliable production feature.
- The browser AI panel is now split into `src/AIPanel.jsx` and loads only when the AI UI is actually opened.
- The first server provider adapter lives in `server/ai/providerClient.js`. It supports Anthropic Messages and OpenAI Responses API request shapes with injected `fetch` and tests.
- The first authenticated server assistant entrypoint lives at `POST /api/ai/assist` through `server/ai/assistHandler.js`. It verifies the current Supabase/CMMS session, builds the deterministic intake draft, rate-limits per user in-process, calls the configured provider only when `CMMS_AI_MODE=server`, and returns read-only assistant text plus the draft.
- `/api/ai/assist` is intentionally not a business-write endpoint. It does not create/update/delete tickets, KV records, Supabase rows, files, or status history. All AI-produced business actions still require a human-confirmed operation through the normal UI/API path.
- Production can enable server AI only after the deployment has the provider env vars and the owner accepts the first read-only assistant scope.

## Product Decision

Do not invest more work in the current browser AI path before release.

When AI is reopened as a product module, build it as a separate server-backed assistant with:

- configurable provider/model selection;
- Anthropic/Claude and OpenAI/Codex-compatible provider options through server-only environment variables;
- a narrow CMMS data context based on the signed-in user's permissions;
- no direct browser calls to Anthropic, OpenAI, or another provider;
- audit-safe request logging;
- clear UI states for disabled, unavailable, and server-backed modes.

## Next Implementation Step

Connect the app settings/UI to the server AI boundary without exposing provider keys:

- add an admin settings surface for provider/mode/model selection that never displays or stores raw provider secrets in browser state;
- keep provider secrets in deployment/server environment only;
- show clear disabled/unavailable/server-ready states in the UI;
- pass only permission-filtered CMMS context to `/api/ai/assist`;
- add audit-safe request logging for provider calls before any future write-capable agent operation.
