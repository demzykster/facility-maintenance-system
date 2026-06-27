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

`client` mode is forbidden in production because provider secrets, rate limiting, audit, and data filtering must live on the server side.

## Current State

- Production defaults to disabled AI when no AI mode is configured.
- Browser AI buttons are hidden unless the frontend AI mode is `client`.
- Demo/local can still use the existing browser AI path and local keyword fallback.

## Next Implementation Step

Add a server AI endpoint that:

- verifies the Supabase user session;
- enforces module permissions and rate limits;
- filters which CMMS data may be sent to the provider;
- keeps provider keys server-only;
- logs requests at an audit-safe level.
