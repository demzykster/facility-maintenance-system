# Business Continuity Guide

This guide describes expected operational response paths. It does not authorize production changes. If a scenario requires a write, deployment, DNS change, restore, rollback, secret rotation, or data cleanup, stop for owner approval.

Owner contact / escalation owner: `OWNER TO DEFINE`.

| Scenario | Detection | Immediate action | Service impact | Data risk | Rollback / recovery path | Owner decision | Evidence to preserve | Stop conditions |
|---|---|---|---|---|---|---|---|---|
| Vercel outage | Vercel status, production unavailable, deploy/log access unavailable. | Check `/cmms-version.json`, `/api/health`, Vercel status. Do not redeploy repeatedly. | App/API may be partially or fully unavailable. | Usually low unless requests fail mid-write; verify audit/ticket outcomes. | Wait for platform recovery, or owner-approved platform contingency. | Required before alias/DNS/platform change. | Status page, failed requests, current SHA, screenshots. | Stop if target platform migration would be improvised. |
| Supabase outage | `/api/health` `database` or `storage` failed, Supabase status degraded. | Check Supabase status read-only; preserve request IDs. | Login/data/API workflows degraded or unavailable. | Elevated for writes attempted during outage. | Wait for recovery; restore only through owner-approved recovery plan. | Required before restore, schema, or data action. | Health output, Supabase status, Vercel logs. | Stop before restore-over-production or manual data edits. |
| Database unavailable | Health database check failed, API 5xx on data routes. | Freeze releases; check Supabase status and env names. | Most authenticated app workflows blocked. | Writes may fail or have unknown outcome; use idempotency/audit checks. | Incident response; recovery drill only in disposable target unless approved. | Required for DB recovery actions. | Health JSON, request IDs, logs, affected routes. | Stop if backup/PITR status is unknown. |
| Storage unavailable | Health storage/config failed, file upload/download errors. | Stop file-write smoke; check storage config/status. | Photos/files affected; core ticket text may still work. | Metadata/object mismatch possible. | Use recovery readiness storage section; do not delete metadata/objects. | Required for storage repair/restore. | File route errors, metadata IDs, object paths if safe. | Stop if evidence includes sensitive file contents. |
| Bad deploy | Version changed and user-visible regression appears. | Capture current and suspected bad SHA; run health; inspect CI. | Depends on regression. | Depends on touched surface and migrations. | Use rollback checklist if safe; otherwise forward-fix. | Required for rollback or hotfix push. | CI run, deployment ID, version JSON, screenshots. | Stop if migrations changed and rollback compatibility is unclear. |
| Broken login | Users cannot sign in; auth routes return errors. | Check health, session endpoints unauth behavior, Supabase Auth status. | High if broad; role-specific if isolated. | Low unless auth/profile records are modified. | Forward-fix preferred unless previous deployment is clearly safe. | Required for auth/env/user changes. | Auth route responses, role/device/time, Supabase status. | Stop before editing users or Auth settings. |
| Domain failure | Production URL unreachable or certificate/DNS failure. | Run domain runbook read-only checks; verify Vercel alias and DNS status if accessible. | App inaccessible on affected domain. | Low if app/data backends healthy. | Keep old working domain active; domain changes require controlled rollout. | Required for DNS/Vercel/Supabase Auth redirect changes. | DNS/cert errors, domain verifier output, Vercel alias state. | Stop if redirects would drop path/query or auth redirects are unknown. |
| DNS failure | DNS lookup/cert mismatch, provider outage. | Confirm via external DNS tools and Vercel domain state. | Users may not reach app. | Low unless users retry writes through stale routes. | Restore DNS only with owner-approved provider access. | Required for DNS changes. | DNS records, TTL, provider status. | Stop if DNS provider/owner is unknown. |
| Expired domain | Domain registrar marks expired or payment issue. | Confirm registrar/DNS provider. Keep Vercel fallback URL available if working. | Custom domain unavailable; fallback may work. | Low. | Renew/restore domain through owner account. | Required; billing/account owner needed. | Registrar notices, expiry date, DNS status. | Stop if ownership is not proven. |
| Lost developer laptop | Local checkout/secrets unavailable. | Use GitHub repository and documented env names; do not recover from chat. | No production impact if cloud access remains. | Risk if local secrets were present. | Rotate local-only secrets if suspected exposed; rebuild from Git. | Required for secret rotation. | Last known commit, access logs if available. | Stop before guessing secrets or using old local files. |
| Lost GitHub access | Cannot push, view CI, or inspect Actions. | Preserve current production version; use local Git read-only. | Release/rollback workflow blocked. | Low until code change needed. | Recover organization/repo access through owner. | Required. | Current SHA, account/access error. | Stop before using unofficial repo copies. |
| Lost Vercel access | Cannot inspect deployments/env/logs. | Use public version/health; do not attempt deployment. | Monitoring/deployment/rollback degraded. | Low until incident requires logs or rollback. | Restore Vercel account access through owner. | Required. | Public health/version, access error. | Stop before creating replacement production project. |
| Lost Supabase access | Cannot inspect DB/Auth/storage/backups. | Use public health only; do not run data changes. | Recovery/debugging degraded. | Elevated if data incident occurs. | Restore Supabase access through owner. | Required. | Health response, access error. | Stop before using service-role from unknown source. |
| Key person unavailable | Owner/operator unavailable for approval. | Continue read-only checks only. | Production change velocity blocked. | Low unless incident needs write action. | Use documented policy; no approval means no production mutation. | `OWNER TO DEFINE` backup approver. | Timeline and pending decision. | Stop before irreversible actions. |
| Corrupted documentation | Docs contradict current Git/production. | Treat Git/code/production health as source; update docs locally only. | Operational confusion. | Low unless docs drive wrong action. | Use docs verification and source order. | Required for process-changing docs. | Conflicting files and checked facts. | Stop if contradiction affects safety-critical action. |
| Production version mismatch | `/cmms-version.json` differs from expected SHA. | Stop deployment/smoke; inspect GitHub/Vercel deployment state. | Unknown until reconciled. | Depends on deployed commit. | Incident response or deployment reconciliation. | Required before push/deploy/rollback. | Version JSON, deployment ID, CI run. | Stop if alias target cannot be proven. |

## Minimum Continuity Evidence Pack

For any significant incident, preserve:

- timestamp and timezone;
- current production SHA;
- `/api/health` response;
- CI run status;
- Vercel deployment/log reference;
- Supabase status reference if relevant;
- user impact summary;
- owner decision;
- final resolution and follow-up.
