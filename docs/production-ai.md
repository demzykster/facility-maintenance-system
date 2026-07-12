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
- The first server provider adapter lives in `server/ai/providerClient.js`. It supports Anthropic Messages and OpenAI Responses API request shapes with injected `fetch` and tests, but it is not yet wired to mutate data or to a broad production assistant flow.
- Production should keep AI disabled until a server endpoint owns provider selection, prompt context, permission filtering, rate limits, and audit.

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

Add a server AI endpoint that:

- verifies the Supabase user session;
- enforces module permissions and rate limits;
- filters which CMMS data may be sent to the provider;
- keeps provider keys server-only;
- logs requests at an audit-safe level.
