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
CMMS_AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
CMMS_AI_MODEL=gemini-2.5-flash
```

or:

```env
CMMS_AI_MODE=server
CMMS_AI_PROVIDER=openai
OPENAI_API_KEY=...
CMMS_AI_MODEL=gpt-5.2
```

Provider names are normalized for operator-friendly setup: `claude` maps to the Anthropic adapter, `gemini` and `google` map to the Google Gemini adapter, while `codex`, `chatgpt`, and `openai` map to the OpenAI Responses adapter. Secrets still live only in server/deployment environment variables.

`client` mode is forbidden in production because provider secrets, rate limiting, audit, and data filtering must live on the server side.

## Current State

- Production defaults to disabled AI when no AI mode is configured.
- Live Vercel status checked on 2026-07-13 initially reported `mode: "disabled"`, `serverReady: false`, and `ai_server_disabled` because no production AI env existed. Production Vercel env was then configured with `CMMS_AI_MODE=server`, `CMMS_AI_PROVIDER=openai`, `CMMS_AI_MODEL`, and a sensitive `OPENAI_API_KEY`. The first post-env provider check exposed a real OpenAI Responses API issue in our status route: `max_output_tokens=8` is below the provider minimum. The code now requests/clamps provider checks to at least 16 output tokens. After that fix deployed, `/api/ai/status?check=1` reached the provider but OpenAI returned a quota/billing failure. The app normalizes that state as `ai_provider_quota_exceeded` in settings and in the AI panel. The server provider boundary now also supports Google Gemini through `GOOGLE_GENERATIVE_AI_API_KEY`, so deployment can switch provider via `CMMS_AI_PROVIDER=gemini` / `google` without browser secrets or UI rewrites.
- Browser AI buttons are hidden unless the frontend AI mode is `client` or saved app settings select server AI mode.
- Demo/local can still use the existing browser AI path and local keyword fallback.
- The `עוזר AI` panel is split into `src/AIPanel.jsx` and loads only when the AI UI is actually opened. Role-specific welcome text and quick workflow prompts live in `src/aiAssistQuickPromptModel.js`, so the UI shell stays thin while admin, executive, manager, technician, cleaner, and worker entry points can evolve independently. The same prompt model also reads the current snapshot metrics to surface contextual prompts such as heatmap load, SLA exposure, pending approvals, PM due items, or field-work urgency before the generic role prompts.
- Dedicated screen-level AI entry points now exist in the BI ticket heatmap, ticket detail, fleet unit detail, PPE stock dashboard, cleaning control dashboard, and supplier/contractor queue. `src/aiAssistEntryPointModel.js` builds human-reviewable heatmap, ticket, fleet, PPE, cleaning, and supplier questions; `src/BIHeatmapPanel.jsx` exposes the heatmap entry point; `TicketDetail` exposes the ticket entry point; `FleetCard` exposes the fleet entry point; `PpeDashboard` exposes the PPE entry point; `CleaningAdmin` exposes the cleaning entry point; `SuppliersPanel` exposes the supplier queue entry point; and `src/AIPanel.jsx` opens with the suggested question prefilled.
- In server mode, the panel calls `POST /api/ai/assist` instead of a browser provider URL. The browser/client provider path remains only a demo/development fallback.
- The browser-side AI context snapshot shape lives in `src/aiAssistSnapshotModel.js`. `src/ClaudeMaintenanceApp.jsx` now only adapts existing ticket/SLA/document helpers into that model before the server route applies authenticated role filtering. The snapshot can include compact supplier summaries (`name`, `type`, `scopes`, linked fleet/open-ticket counts) without supplier contacts, addresses, or private notes; the server passes those summaries through only for roles/users with supplier visibility.
- The first server provider adapter lives in `server/ai/providerClient.js`. It supports Anthropic Messages, Google Gemini `generateContent`, and OpenAI Responses API request shapes with injected `fetch` and tests. `src/aiProviderModel.js` owns the safe provider options, labels, default models, aliases, and env-key readiness checks used by the server status route and admin settings UI.
- The first authenticated server assistant entrypoint lives at `POST /api/ai/assist` through `server/ai/assistHandler.js`. It verifies the current Supabase/CMMS session, builds the deterministic intake draft, filters any supplied UI context by the authenticated user's role/scope through `src/aiAssistContextModel.js`, applies explicit workflow instructions and role-specific guidance from `src/aiAssistWorkflowModel.js`, rate-limits per user in-process, calls the configured provider only when `CMMS_AI_MODE=server`, writes an audit-safe `system / ai_assist` event when an audit driver is configured, and returns read-only assistant text plus the draft. The same context filter can pass compact BI/heatmap summaries (`bi.heatmap`) to the provider after department/role filtering, so executive/admin answers can use risk concentration signals without exposing unrelated department detail to managers.
- AI API URLs are grouped through one Vercel route file, `api/ai/[action].js`, so `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status` do not consume one function each as the AI surface grows.
- The admin settings surface can store non-secret AI preferences (`config.ai.mode`, `config.ai.provider`, and `config.ai.model`) and reads `/api/ai/status` for server readiness. It can also request `/api/ai/status?check=1` to run an admin-only live provider ping from the server. Provider API keys stay in deployment/server environment variables only and are never displayed or stored in browser-managed app config.
- Setup failures are intentionally explicit: settings and the AI panel surface `ai_server_disabled`, `ai_provider_required`, `ai_provider_key_required`, rate-limit, and provider-check failures as operator-facing messages instead of a generic network/offline error.
- `/api/ai/assist` is intentionally not a business-write endpoint. It does not create/update/delete tickets, KV records, Supabase rows, files, or status history. It can return deterministic action proposals such as `ticket.create`; the browser UI can execute a complete proposal only after a human presses the confirmation button. Execution goes through the existing `saveTicket` path and therefore the normal `/api/tickets` validation, authorization, persistence, notifications, and audit trail. If a proposal is incomplete or the user wants to review it first, the AI panel can open the normal ticket form with a safe prefill; the user still completes and submits the ticket manually through the same form path. The first update-capable action is `ticket.update`: `/api/ai/assist` can propose constrained priority/status updates, supplier-routing updates, and waiting-reason updates only when the role-filtered context contains a single visible target ticket. Supplier routing additionally requires an explicit supplier name match from the filtered supplier context; invisible, ambiguous, missing, or unchanged supplier requests produce no action. Waiting status proposals require a concrete reason such as parts, supplier, access, budget approval, safety hold, or missing equipment; generic waiting requests produce no action, and moving a waiting ticket back to work clears `waitingReason` and `waitBall`. Update proposals include a compact `current` snapshot for the changed fields so `src/AIPanel.jsx` can show before/after rows before confirmation. Execution can only patch a small allow-list of ticket fields, records a field diff and `ai_confirmed_update` log entry, and still saves only through the existing ticket path after human confirmation. `ticket.comment` is also available for explicit "add note/comment" requests when exactly one role-visible ticket remains in context; it appends an `ai_confirmed_comment` log entry only after human confirmation. Work-record actions follow the same rule: `task.create`, constrained `task.update`, `meeting.create`, and constrained `meeting.update` proposals can be executed only after human confirmation and only through `saveTask` / `saveMeeting` over `/api/work`. Current task updates are limited to status, priority, and deterministic due-date changes for exactly one visible task: relative wording (`today`, `tomorrow`, `in N days`, plus Hebrew equivalents) and explicit calendar dates in `DD.MM.YY`, `DD.MM.YYYY`, `DD/MM/YY`, or `DD/MM/YYYY` formats. Current meeting creation is deliberately narrow: it creates a planned meeting, defaults the current actor as owner/participant, requires deterministic relative or calendar date wording, applies explicit `HH:mm` time when present, and appends `ai_confirmed_meeting`. Current meeting updates are even narrower: they can change only `at`, require exactly one role-visible meeting, require explicit relative or calendar date/time wording, append `ai_confirmed_meeting_update`, and save through the same `saveMeeting` path. AI does not infer extra participants, rooms, recurring rules, meeting deletes, or ambiguous meeting targets. Responsible-user changes, task delete, and richer meeting operations remain separate future safety slices.
- AI ticket zone/location updates are now part of that constrained `ticket.update` surface: explicit phrases such as `תעדכן את הקריאה לאזור משרדים` can propose a `zone` patch for exactly one role-visible ticket. The parser does not treat ordinary free-text location mentions as mutation intent, and execution still requires human confirmation through the normal ticket save path.
- AI transport-unit updates are similarly constrained: explicit phrases such as `תעדכן את הקריאה לכלי 120823` can propose `forkliftId` plus `asset` only when exactly one matching fleet unit code/id exists in the already role-filtered fleet context. Hidden, ambiguous, unchanged, or absent fleet codes produce no action. Explicit ticket update wording must never fall back to `ticket.create` just because a concrete update proposal could not be built.
- AI transport ticket creation can now prefill the fleet unit in a `ticket.create` draft when the user explicitly mentions a unique visible fleet unit code/id, for example `מלגזה 120823 תקועה באזור טעינה`. It can also prefill `downtimeType` only from explicit downtime wording: no replacement / critical downtime (`critical`), replacement available (`has_replacement`), or can continue working / minor downtime (`minor`). This does not write data, does not guess from hidden or ambiguous fleet codes, and does not infer downtime type from vague fault text.
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

Build the next AI product slice on top of the human-confirmed assistant:

- deepen the first workflow modes (`risk_summary`, `sla_explanation`, `next_actions`, `draft_preparation`) with richer workflow-specific summaries and more granular role-specific detail cards where users naturally need an explanation or next-action summary;
- expand the action surface one operation at a time, always through an existing normal server operation with validation, authorization, and audit. The current action surface is `ticket.create`, `ticket.comment`, constrained `ticket.update` proposals for single visible ticket priority/status/supplier-routing/waiting-reason/explicit zone-location/explicit transport-unit changes, plus `task.create`, constrained `task.update` for single visible task status/priority/explicit relative or calendar due-date changes, `meeting.create`, and constrained `meeting.update` for single visible meeting time changes; next slices can add more deterministic update scenarios without trusting provider free text;
- deepen guided completion for incomplete proposals. The current safe handoff opens the normal ticket form with AI prefill; transport drafts can already prefill a unique visible fleet unit from an explicit code/id and an explicit downtime level from clear no-replacement / replacement / can-continue wording. Future slices can add field-specific guidance inside that form for missing downtime type, severity, and operational follow-up;
- deepen supplier-routing after the current explicit-match proposal by adding better review UI and, later, supplier-technician acceptance flows without assigning a concrete assignee prematurely;
- keep financial and broad company analytics limited to `admin` / `executive`;
- keep every future AI write behind a human-confirmed normal server operation with validation, authorization, and audit.

## Architecture Audit: Provider And Tooling

Current implementation does not use Vercel AI SDK or LangChain yet. It uses a small server-only adapter in `server/ai/providerClient.js` plus deterministic CMMS action builders in `src/aiAssistActionModel.js`.

This is acceptable for the current controlled rollout because model text is not trusted for database writes. The provider returns assistant text only; executable actions are built by deterministic server-side code from role-filtered context and explicit user wording, remain `writesData: false`, and execute only through existing app operations after a human confirms them in the UI.

The limitation is that provider integration and future native tool/function calling are custom. The recommended migration path is:

1. Keep the current deterministic action layer as the safety boundary.
2. Introduce Vercel AI SDK Core behind `server/ai/providerClient.js` as an internal implementation detail, not as a UI rewrite.
3. Map OpenAI, Anthropic, and Google models through one SDK-backed `generateText` / tool-calling interface.
4. Keep CMMS mutations as proposed actions requiring human confirmation; do not let provider-native tools write directly to the database.
5. Add one provider at a time under the same tests before enabling SDK-native multi-step/tool loops.
