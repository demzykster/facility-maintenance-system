# Environment Variable Reference

This reference documents variable names and purposes only. It intentionally excludes values.

Last verified against local commit: `24213dc` using code, workflow, and env-template inspection.

| Name | Timing | Sensitivity | Required | Consumed by | Provider | Safe to rotate | Restart/redeploy | Missing behavior |
|---|---|---|---|---|---|---|---|---|
| `VITE_CMMS_APP_MODE` | Build/browser runtime | Public | Required for production-like builds | `src/*`, preflight | Application | Yes | Rebuild/redeploy | Wrong mode may enable demo assumptions or fail preflight. |
| `VITE_CMMS_STORAGE_PROVIDER` | Build/browser runtime | Public | Required for API-backed production | storage adapters, preflight | Application | Yes | Rebuild/redeploy | Production storage provider gate fails or browser uses local fallback. |
| `VITE_CMMS_STORAGE_API_URL` | Build/browser runtime | Public | Required for API-backed production | storage adapters | Application | Yes | Rebuild/redeploy | Browser cannot reach normalized API storage routes. |
| `VITE_SUPABASE_URL` | Build/browser runtime | Public | Required for Supabase login | session/login and preflight | Application | Yes with coordinated Supabase change | Rebuild/redeploy | Browser Auth login fails. |
| `VITE_SUPABASE_ANON_KEY` | Build/browser runtime | Public credential | Required for Supabase login | session/login and preflight | Application | Yes with Supabase anon-key rotation | Rebuild/redeploy | Browser Auth login fails. |
| `VITE_CMMS_AUTH_MODE` | Build/browser runtime | Public | Optional | production login config | Application | Yes | Rebuild/redeploy | Falls back to configured/default auth mode. |
| `VITE_CMMS_AI_MODE` | Build/browser runtime | Public | Optional | AI mode display/gates | Application | Yes | Rebuild/redeploy | AI browser state may show disabled/demo mode. |
| `VITE_CMMS_PUBLIC_COMPLAINT_API_URL` | Build/browser runtime | Public | Optional | public complaint client | Application | Yes | Rebuild/redeploy | Defaults to same-origin `/api/public/complaints`. |
| `SUPABASE_URL` | Runtime | Secret-adjacent endpoint | Required for production API | server Supabase clients | Application | Yes with coordinated Supabase change | Redeploy/restart | API routes using Supabase fail or health degrades. |
| `SUPABASE_ANON_KEY` | Runtime | Secret/public credential | Required for session validation | server session clients | Application | Yes with Supabase anon-key rotation | Redeploy/restart | Auth/session validation fails. |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | Secret | Required for server-side BFF drivers | server Supabase service-role drivers | Application | Yes with strict rotation plan | Redeploy/restart | Data/storage/audit/server operations fail; never expose to browser. |
| `CMMS_SESSION_SECRET` | Runtime | Secret | Required for CMMS PIN/session JWT paths | session/auth handlers | Application | Yes with session invalidation plan | Redeploy/restart | PIN/CMMS sessions fail or cannot be verified. |
| `CMMS_KV_AUTH` | Runtime | Operational | Required in production-like API mode | KV/session handlers and gates | Application | Yes | Redeploy/restart | KV/API auth mode misconfigured; preflight fails. |
| `CMMS_KV_DRIVER` | Runtime | Operational | Required in production-like API mode | KV/session/users/push handlers | Application | Yes | Redeploy/restart | KV driver unavailable; routes fail. |
| `CMMS_DATA_AUTHORITY` | Runtime | Operational | Required for normalized production authority | production guards and retired KV logic | Application | Yes with owner approval | Redeploy/restart | Data authority gates fail or compatibility behavior changes. |
| `CMMS_ALLOW_PRODUCTION_KV_BRIDGE` | Runtime | Operational | Required while compatibility bridge is accepted | production config gate | Application | Yes with owner approval | Redeploy/restart | Production config gate fails if bridge still required. |
| `CMMS_KV_SUPABASE_TABLE` | Runtime | Operational | Optional | Supabase KV driver | Application | Yes | Redeploy/restart | Defaults to `cmms_kv_records`. |
| `CMMS_KV_RATE_LIMIT_MAX` | Runtime | Operational | Optional | KV rate limiter | Application | Yes | Redeploy/restart | Defaults to internal limit. |
| `CMMS_KV_RATE_LIMIT_WINDOW_MS` | Runtime | Operational | Optional | KV rate limiter | Application | Yes | Redeploy/restart | Defaults to internal window. |
| `CMMS_KV_RATE_LIMIT_DISABLED` | Runtime | Operational | Optional | KV rate limiter | Application | Yes | Redeploy/restart | Rate limiter remains enabled. |
| `CMMS_KV_ALLOW_UNAUTHENTICATED` | Runtime | Operational/security | Optional | KV handler | Application | Yes with security review | Redeploy/restart | Unauthenticated KV disabled. |
| `CMMS_KV_BEARER_TOKEN` | Runtime | Secret | Optional legacy/token mode | KV handler | Application | Yes | Redeploy/restart | Token KV mode unavailable. |
| `CMMS_FILE_DRIVER` | Runtime | Operational | Required for production file storage | file/public handlers | Application | Yes | Redeploy/restart | File storage routes fail or health degrades. |
| `CMMS_FILE_BUCKET` | Runtime | Operational | Required for Supabase file storage | file drivers/schema checks | Application | Yes with storage migration plan | Redeploy/restart | Upload/download/storage health fails. |
| `CMMS_FILE_METADATA_DRIVER` | Runtime | Operational | Required for production file metadata | file handlers/drivers | Application | Yes | Redeploy/restart | File metadata authorization fails. |
| `CMMS_FILE_METADATA_SUPABASE_TABLE` | Runtime | Operational | Optional | file metadata driver | Application | Yes with schema review | Redeploy/restart | Defaults to `file_metadata`. |
| `CMMS_FILE_ALLOWED_PREFIXES` | Runtime | Operational/security | Optional | file handler | Application | Yes with security review | Redeploy/restart | Defaults to `tickets/,cleaning/`. |
| `CMMS_FILE_MAX_BYTES` | Runtime | Operational/security | Optional | file handler | Application | Yes | Redeploy/restart | Defaults to 10 MB. |
| `CMMS_AUDIT_DRIVER` | Runtime | Operational | Required for production audit | audit-enabled handlers | Application | Yes | Redeploy/restart | Audit writes disabled/degraded depending route. |
| `CMMS_AUDIT_SUPABASE_TABLE` | Runtime | Operational | Optional | audit driver | Application | Yes with schema review | Redeploy/restart | Defaults to `audit_events`. |
| `CMMS_PUBLIC_COMPLAINTS_ENABLED` | Runtime | Operational | Required if public complaints are enabled | public complaint handler/preflight | Application | Yes | Redeploy/restart | Public complaints disabled. |
| `CMMS_PUBLIC_COMPLAINTS_DRIVER` | Runtime | Operational | Required if public complaints are enabled | public complaint handler/preflight | Application | Yes | Redeploy/restart | Public complaints unavailable. |
| `CMMS_PUBLIC_COMPLAINT_RATE_LIMIT_MS` | Runtime | Operational | Optional | public complaint handler | Application | Yes | Redeploy/restart | Defaults to internal rate limit. |
| `CMMS_BOOTSTRAP_ENABLED` | Runtime | Security-sensitive | Optional, first-admin only | bootstrap handler/preflight | Application | Yes | Redeploy/restart | Bootstrap remains disabled unless explicitly enabled. |
| `CMMS_BOOTSTRAP_TOKEN` | Runtime | Secret | Optional, first-admin only | bootstrap handler/preflight | Application | Rotate/remove immediately after use | Redeploy/restart | Bootstrap unauthorized/disabled. |
| `CMMS_TICKET_SERVER_CREATE_V2` | Runtime | Operational | Required for server-create rollout | ticket create gates | Application | Yes with rollout approval | Redeploy/restart | Server-create path disabled. |
| `CMMS_TICKET_SERVER_CREATE_V2_READY` | Runtime | Operational | Required for server-create readiness | ticket create gates | Application | Yes with rollout approval | Redeploy/restart | Server-create readiness denied. |
| `CMMS_AI_MODE` | Runtime | Operational | Required for server AI | AI config/status/assist | Application | Yes | Redeploy/restart | AI server path disabled or status degraded. |
| `CMMS_AI_PROVIDER` | Runtime | Operational | Required when AI server mode is enabled | AI provider model | Application | Yes | Redeploy/restart | AI provider unavailable. |
| `CMMS_AI_MODEL` | Runtime | Operational | Optional | AI provider model | Application | Yes | Redeploy/restart | Defaults by provider. |
| `ANTHROPIC_API_KEY` | Runtime | Secret | Required if Anthropic provider selected | AI provider/status | Application/provider | Yes | Redeploy/restart | Anthropic calls fail/status degraded. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Runtime | Secret | Required if Google provider selected | AI provider/status | Application/provider | Yes | Redeploy/restart | Google calls fail/status degraded. |
| `GOOGLE_API_KEY` | Runtime | Secret | Optional fallback for Google provider | AI provider/status | Application/provider | Yes | Redeploy/restart | Ignored if primary Google key exists. |
| `OPENAI_API_KEY` | Runtime | Secret | Required if OpenAI provider selected | AI provider/status | Application/provider | Yes | Redeploy/restart | OpenAI calls fail/status degraded. |
| `CMMS_AI_ASSIST_MAX_TOKENS` | Runtime | Operational | Optional | AI assist handler | Application | Yes | Redeploy/restart | Defaults to internal max tokens. |
| `CMMS_AI_PLAN_MAX_TOKENS` | Runtime | Operational | Optional | AI assist planning | Application | Yes | Redeploy/restart | Defaults to internal plan max tokens. |
| `CMMS_AI_ASSIST_RATE_LIMIT_MS` | Runtime | Operational | Optional | AI assist rate guard | Application | Yes | Redeploy/restart | Defaults to internal guard. |
| `CMMS_AI_INLINE_TICKET_CREATE_RATE_LIMIT_MS` | Runtime | Operational | Optional | inline ticket create burst guard | Application | Yes | Redeploy/restart | Defaults to internal guard. |
| `CMMS_AI_MEMORY_PILOT` | Runtime | Operational | Optional rollout flag | memory model/handler | Application | Yes with rollout approval | Redeploy/restart | Memory pilot effective access denied. |
| `CMMS_AI_CONVERSATIONS_PILOT` | Runtime | Operational | Optional rollout flag | conversation model/handler | Application | Yes with rollout approval | Redeploy/restart | Durable conversations disabled. |
| `CMMS_AI_AUTONOMOUS_TICKET_CREATE` | Runtime | Operational/security | Optional rollout flag | autonomous ticket gate | Application | Yes with rollout approval | Redeploy/restart | Autonomous ticket create disabled. |
| `CMMS_AI_MEMORY_FACTS_SUPABASE_TABLE` | Runtime | Operational | Optional | memory store | Application | Yes with schema review | Redeploy/restart | Defaults to `ai_memory_facts`. |
| `CMMS_AI_CONVERSATIONS_SUPABASE_TABLE` | Runtime | Operational | Optional | conversation store | Application | Yes with schema review | Redeploy/restart | Defaults to `ai_conversations`. |
| `CMMS_AI_CONVERSATION_MESSAGES_SUPABASE_TABLE` | Runtime | Operational | Optional | conversation store | Application | Yes with schema review | Redeploy/restart | Defaults to `ai_conversation_messages`. |
| `CMMS_HEALTH_TIMEOUT_MS` | Runtime/tool | Operational | Optional | health handler/checks | Application | Yes | Redeploy/restart for server; none for local tool. | Defaults to internal timeout. |
| `CMMS_BUILD_COMMIT` | Runtime | Public trace | Recommended on non-Vercel hosts | health handler | Application/platform | Yes | Redeploy/restart | Health falls back to Vercel SHA/package/local. |
| `VERCEL_GIT_COMMIT_SHA` | Build/runtime | Platform-provided | Vercel-provided | Vite version and health fallback | Platform | No direct rotation | Build/redeploy | Version falls back to local Git/package. |
| `VERCEL` | Runtime | Platform-provided | Vercel-provided | auth cookie secure detection | Platform | No | Redeploy | `NODE_ENV=production` still sets Secure outside Vercel. |
| `VERCEL_TOKEN` | Tooling | Secret | Required only for Vercel CLI checks | staging Vercel env tooling | Platform/operator | Yes | No app redeploy unless env changes | Vercel env preflight cannot run. |
| `PORT` | Runtime/tool | Public | Required by many non-Vercel hosts | static server / future adapter | Platform | Yes | Restart | Defaults to static-server local port. |
| `CMMS_DOMAIN_CURRENT_URL` | Tooling | Public | Optional | domain verifier | Application/tool | Yes | No app redeploy | CLI requires explicit URL if absent. |
| `CMMS_DOMAIN_CANDIDATE_URL` | Tooling | Public | Optional | domain verifier | Application/tool | Yes | No app redeploy | CLI requires explicit URL if absent. |
| `CMMS_DOMAIN_EXPECTED_SHA` | Tooling | Public | Optional | domain verifier | Application/tool | Yes | No app redeploy | CLI requires explicit SHA if absent. |
| `CMMS_ROLLBACK_PRODUCTION_URL` | Tooling | Public | Optional | rollback verifier | Application/tool | Yes | No app redeploy | CLI requires explicit URL if absent. |
| `CMMS_ROLLBACK_EXPECTED_CURRENT_SHA` | Tooling | Public | Optional | rollback verifier | Application/tool | Yes | No app redeploy | CLI requires explicit SHA if absent. |
| `CMMS_ROLLBACK_TARGET_SHA` | Tooling | Public | Optional | rollback verifier | Application/tool | Yes | No app redeploy | CLI requires explicit target if absent. |
| `CMMS_PUSH_CONTACT` | Runtime | Operational/contact | Required if push enabled | push handler/model | Application | Yes | Redeploy/restart | Push remains disabled. |
| `CMMS_PUSH_VAPID_PUBLIC_KEY` | Runtime/browser-exposed through API | Public credential | Required if push enabled | push handler/model | Application | Yes with push re-subscription plan | Redeploy/restart | Push remains disabled. |
| `CMMS_PUSH_VAPID_PRIVATE_KEY` | Runtime | Secret | Required if push enabled | push handler/model | Application | Yes with push re-subscription plan | Redeploy/restart | Push remains disabled. |

Staging/demo smoke variables such as `CMMS_STAGING_APP_URL`, `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD`, `ADMIN_EMAIL`, and demo smoke credentials are tooling-only. They must not be treated as production app runtime requirements.
