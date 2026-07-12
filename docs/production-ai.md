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
- AI API URLs are grouped through one Vercel route file, `api/ai/[action].js`, so `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status` do not consume one function each as the AI surface grows.
- The admin settings surface can store non-secret AI preferences (`config.ai.mode`, `config.ai.provider`, and `config.ai.model`) and reads `/api/ai/status` for server readiness. Provider API keys stay in deployment/server environment variables only and are never displayed or stored in browser-managed app config.
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

Build the first permission-filtered AI context slice:

- pass only role-appropriate CMMS context to `/api/ai/assist` for admin, executive, manager, technician, worker, and public-report use cases;
- keep financial and broad company analytics limited to `admin` / `executive`;
- keep department managers inside their existing ticket/fleet/user scope;
- add audit-safe request logging for provider calls before any future write-capable agent operation;
- keep every future AI write behind a human-confirmed normal server operation with validation, authorization, and audit.
