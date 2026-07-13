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

Provider names are normalized for operator-friendly setup: `claude` maps to the Anthropic adapter, while `codex`, `chatgpt`, and `openai` map to the OpenAI Responses adapter. Secrets still live only in server/deployment environment variables.

`client` mode is forbidden in production because provider secrets, rate limiting, audit, and data filtering must live on the server side.

## Current State

- Production defaults to disabled AI when no AI mode is configured.
- Browser AI buttons are hidden unless the frontend AI mode is `client` or saved app settings select server AI mode.
- Demo/local can still use the existing browser AI path and local keyword fallback.
- The `עוזר AI` panel is split into `src/AIPanel.jsx` and loads only when the AI UI is actually opened. Role-specific welcome text and quick workflow prompts live in `src/aiAssistQuickPromptModel.js`, so the UI shell stays thin while admin, executive, manager, technician, cleaner, and worker entry points can evolve independently. The same prompt model also reads the current snapshot metrics to surface contextual prompts such as heatmap load, SLA exposure, pending approvals, PM due items, or field-work urgency before the generic role prompts.
- Dedicated screen-level AI entry points now exist in the BI ticket heatmap, ticket detail, and fleet unit detail. `src/aiAssistEntryPointModel.js` builds human-reviewable heatmap, ticket, and fleet questions, `src/BIHeatmapPanel.jsx` exposes the heatmap entry point, `TicketDetail` exposes the ticket entry point, `FleetCard` exposes the fleet entry point, and `src/AIPanel.jsx` opens with the suggested question prefilled. The assistant still waits for the human to send the question and remains read-only.
- In server mode, the panel calls `POST /api/ai/assist` instead of a browser provider URL. The browser/client provider path remains only a demo/development fallback.
- The browser-side AI context snapshot shape lives in `src/aiAssistSnapshotModel.js`. `src/ClaudeMaintenanceApp.jsx` now only adapts existing ticket/SLA/document helpers into that model before the server route applies authenticated role filtering.
- The first server provider adapter lives in `server/ai/providerClient.js`. It supports Anthropic Messages and OpenAI Responses API request shapes with injected `fetch` and tests. `src/aiProviderModel.js` owns the safe provider options, labels, default models, and aliases used by the server status route and admin settings UI.
- The first authenticated server assistant entrypoint lives at `POST /api/ai/assist` through `server/ai/assistHandler.js`. It verifies the current Supabase/CMMS session, builds the deterministic intake draft, filters any supplied UI context by the authenticated user's role/scope through `src/aiAssistContextModel.js`, applies explicit workflow instructions and role-specific guidance from `src/aiAssistWorkflowModel.js`, rate-limits per user in-process, calls the configured provider only when `CMMS_AI_MODE=server`, writes an audit-safe `system / ai_assist` event when an audit driver is configured, and returns read-only assistant text plus the draft. The same context filter can pass compact BI/heatmap summaries (`bi.heatmap`) to the provider after department/role filtering, so executive/admin answers can use risk concentration signals without exposing unrelated department detail to managers.
- AI API URLs are grouped through one Vercel route file, `api/ai/[action].js`, so `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status` do not consume one function each as the AI surface grows.
- The admin settings surface can store non-secret AI preferences (`config.ai.mode`, `config.ai.provider`, and `config.ai.model`) and reads `/api/ai/status` for server readiness. Provider API keys stay in deployment/server environment variables only and are never displayed or stored in browser-managed app config.
- `/api/ai/assist` is intentionally not a business-write endpoint. It does not create/update/delete tickets, KV records, Supabase rows, files, or status history. All AI-produced business actions still require a human-confirmed operation through the normal UI/API path.
- Production can enable server AI after the deployment has the provider env vars and the owner accepts the first read-only assistant scope.

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

Build the next AI product slice on top of the read-only assistant:

- deepen the first workflow modes (`risk_summary`, `sla_explanation`, `next_actions`, `draft_preparation`) with richer workflow-specific summaries and dedicated screen-level entry points beyond the shared quick prompts;
- repeat the same dedicated-entry pattern for PPE/cleaning risk panels and supplier queues where a user naturally wants an explanation or next-action summary;
- expand the audit surface only if new workflow-specific AI actions need additional non-sensitive metadata;
- keep financial and broad company analytics limited to `admin` / `executive`;
- keep every future AI write behind a human-confirmed normal server operation with validation, authorization, and audit.
