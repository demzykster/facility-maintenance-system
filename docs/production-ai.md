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
- Dedicated screen-level AI entry points now exist in the BI ticket heatmap, ticket detail, fleet unit detail, PPE stock dashboard, cleaning control dashboard, and supplier/contractor queue. `src/aiAssistEntryPointModel.js` builds human-reviewable heatmap, ticket, fleet, PPE, cleaning, and supplier questions; `src/BIHeatmapPanel.jsx` exposes the heatmap entry point; `TicketDetail` exposes the ticket entry point; `FleetCard` exposes the fleet entry point; `PpeDashboard` exposes the PPE entry point; `CleaningAdmin` exposes the cleaning entry point; `SuppliersPanel` exposes the supplier queue entry point; and `src/AIPanel.jsx` opens with the suggested question prefilled.
- In server mode, the panel calls `POST /api/ai/assist` instead of a browser provider URL. The browser/client provider path remains only a demo/development fallback.
- The browser-side AI context snapshot shape lives in `src/aiAssistSnapshotModel.js`. `src/ClaudeMaintenanceApp.jsx` now only adapts existing ticket/SLA/document helpers into that model before the server route applies authenticated role filtering. The snapshot can include compact supplier summaries (`name`, `type`, `scopes`, linked fleet/open-ticket counts) without supplier contacts, addresses, or private notes; the server passes those summaries through only for roles/users with supplier visibility.
- The first server provider adapter lives in `server/ai/providerClient.js`. It supports Anthropic Messages and OpenAI Responses API request shapes with injected `fetch` and tests. `src/aiProviderModel.js` owns the safe provider options, labels, default models, and aliases used by the server status route and admin settings UI.
- The first authenticated server assistant entrypoint lives at `POST /api/ai/assist` through `server/ai/assistHandler.js`. It verifies the current Supabase/CMMS session, builds the deterministic intake draft, filters any supplied UI context by the authenticated user's role/scope through `src/aiAssistContextModel.js`, applies explicit workflow instructions and role-specific guidance from `src/aiAssistWorkflowModel.js`, rate-limits per user in-process, calls the configured provider only when `CMMS_AI_MODE=server`, writes an audit-safe `system / ai_assist` event when an audit driver is configured, and returns read-only assistant text plus the draft. The same context filter can pass compact BI/heatmap summaries (`bi.heatmap`) to the provider after department/role filtering, so executive/admin answers can use risk concentration signals without exposing unrelated department detail to managers.
- AI API URLs are grouped through one Vercel route file, `api/ai/[action].js`, so `/api/ai/intake`, `/api/ai/assist`, and `/api/ai/status` do not consume one function each as the AI surface grows.
- The admin settings surface can store non-secret AI preferences (`config.ai.mode`, `config.ai.provider`, and `config.ai.model`) and reads `/api/ai/status` for server readiness. It can also request `/api/ai/status?check=1` to run an admin-only live provider ping from the server. Provider API keys stay in deployment/server environment variables only and are never displayed or stored in browser-managed app config.
- `/api/ai/assist` is intentionally not a business-write endpoint. It does not create/update/delete tickets, KV records, Supabase rows, files, or status history. It can return deterministic action proposals such as `ticket.create`; the browser UI can execute a complete proposal only after a human presses the confirmation button. Execution goes through the existing `saveTicket` path and therefore the normal `/api/tickets` validation, authorization, persistence, notifications, and audit trail. If a proposal is incomplete or the user wants to review it first, the AI panel can open the normal ticket form with a safe prefill; the user still completes and submits the ticket manually through the same form path. The first update-capable action is `ticket.update`: `/api/ai/assist` can propose constrained priority/status updates, supplier-routing updates, and waiting-reason updates only when the role-filtered context contains a single visible target ticket. Supplier routing additionally requires an explicit supplier name match from the filtered supplier context; invisible, ambiguous, missing, or unchanged supplier requests produce no action. Waiting status proposals require a concrete reason such as parts, supplier, access, budget approval, safety hold, or missing equipment; generic waiting requests produce no action, and moving a waiting ticket back to work clears `waitingReason` and `waitBall`. Update proposals include a compact `current` snapshot for the changed fields so `src/AIPanel.jsx` can show before/after rows before confirmation. Execution can only patch a small allow-list of ticket fields, records a field diff and `ai_confirmed_update` log entry, and still saves only through the existing ticket path after human confirmation. `ticket.comment` is also available for explicit "add note/comment" requests when exactly one role-visible ticket remains in context; it appends an `ai_confirmed_comment` log entry only after human confirmation. Work-record actions follow the same rule: `task.create`, constrained `task.update`, and `meeting.create` proposals can be executed only after human confirmation and only through `saveTask` / `saveMeeting` over `/api/work`. Current task updates are limited to status, priority, and deterministic relative due-date changes (`today`, `tomorrow`, `in N days`, plus Hebrew equivalents) for exactly one visible task. Current meeting creation is deliberately narrow: it creates a planned meeting, defaults the current actor as owner/participant, requires deterministic relative date wording, applies explicit `HH:mm` time when present, appends `ai_confirmed_meeting`, and does not infer extra participants, rooms, recurring rules, meeting updates, or meeting deletes. Free-form calendar-date parsing, responsible-user changes, task delete, and richer meeting operations remain separate future safety slices.
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
- expand the action surface one operation at a time, always through an existing normal server operation with validation, authorization, and audit. The current action surface is `ticket.create`, `ticket.comment`, constrained `ticket.update` proposals for single visible ticket priority/status/supplier-routing/waiting-reason changes, plus `task.create`, constrained `task.update` for single visible task status/priority/explicit relative due-date changes, and narrow `meeting.create`; next slices can add more deterministic update scenarios without trusting provider free text;
- deepen guided completion for incomplete proposals. The current safe handoff opens the normal ticket form with AI prefill; future slices can add field-specific guidance inside that form, especially for transport tickets that require an exact fleet unit and downtime type before creation;
- deepen supplier-routing after the current explicit-match proposal by adding better review UI and, later, supplier-technician acceptance flows without assigning a concrete assignee prematurely;
- keep financial and broad company analytics limited to `admin` / `executive`;
- keep every future AI write behind a human-confirmed normal server operation with validation, authorization, and audit.
