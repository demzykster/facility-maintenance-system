# Access and Dependency Register

This register lists systems and access requirements without secret values. Missing owners are marked `OWNER TO DEFINE`; do not invent contacts or backup accounts.

Last verified against local commit: `24213dc` with production/origin baseline `567a5f9`.

| System | Purpose | Owner | Minimum required role | Recovery method | Verification status | Last verified commit | Missing owner decisions |
|---|---|---|---|---|---|---|---|
| GitHub repository `demzykster/facility-maintenance-system` | Source, reviews, CI, release history. | OWNER TO DEFINE | Maintainer/admin for protected operations; read for audit. | Restore GitHub org/repo access through owner. | Verified from `git remote -v`. | `24213dc` | Backup repository admin. |
| GitHub Actions `CI` | Main and PR verification. | OWNER TO DEFINE | Actions read; maintainer for workflow changes. | Restore GitHub access. | Verified in `.github/workflows/ci.yml`. | `24213dc` | Required reviewers and branch protection policy. |
| GitHub Actions `Manual Health Monitor` | Manual read-only health check. | OWNER TO DEFINE | Actions run permission. | Restore GitHub access. | Verified in `.github/workflows/manual-health-monitor.yml`. | `24213dc` | Who may run manual monitor. |
| GitHub Actions `Staging Gate` | Controlled staging/live-like verification when approved. | OWNER TO DEFINE | Actions run permission plus configured secrets. | Restore GitHub and secret access. | Verified in `.github/workflows/staging-gate.yml`. | `24213dc` | Who owns staging gate secrets. |
| Vercel project `facility-maintenance-system` | Current hosting/deployment/function runtime. | OWNER TO DEFINE | Project admin for env/alias/rollback; viewer for logs. | Recover Vercel team/project access through owner. | Verified by production URL/version; no config changed. | `24213dc` | Backup Vercel admin and billing owner. |
| Production domain `facility-maintenance-system.vercel.app` | Current public URL. | Vercel-managed | Vercel project access. | Vercel project recovery. | Verified through `/cmms-version.json` and `/api/health`. | `24213dc` | Future custom domain owner. |
| DNS provider | Custom domain/DNS when added. | OWNER TO DEFINE | Registrar/DNS admin. | Account recovery with registrar/provider. | Not proven in repository. | `24213dc` | DNS provider, billing owner, backup admin. |
| Supabase project `ofwcdifzofzzucizpxqy` | Auth, Postgres, Storage, API data authority. | OWNER TO DEFINE | Project owner/admin for recovery; SQL/editor only with approval. | Supabase organization/project recovery. | Verified from prior runbooks and production health. | `24213dc` | Backup Supabase owner, RPO/RTO, PITR decision. |
| Supabase Auth | User authentication and sessions. | OWNER TO DEFINE | Supabase Auth admin. | Supabase project recovery. | Current app uses Supabase Auth/app profiles. | `24213dc` | Recovery owner and leaked-password setting verification. |
| Supabase Storage bucket `cmms-files` | Private ticket/cleaning/user file storage. | OWNER TO DEFINE | Supabase storage admin. | Supabase project/storage recovery. | Documented in storage/recovery docs; current object restore not freshly drilled. | `24213dc` | Storage backup/restore method. |
| npm registry | Dependency installation. | npm/public registry | No app-specific owner unless packages change. | Use lockfile and npm registry availability. | `package-lock.json` present. | `24213dc` | Private registry not used. |
| AI providers | Server-side AI assistant/provider calls. | OWNER TO DEFINE | Provider account/env secret manager. | Rotate/re-enter provider key through approved env process. | Provider boundary exists; provider account ownership not proven. | `24213dc` | Provider billing owner and fallback provider policy. |
| Browser push service / VAPID | Push notifications when enabled. | OWNER TO DEFINE | Env secret manager. | Rotate VAPID keys with owner approval. | Code references push env; live enablement not asserted here. | `24213dc` | Push owner and rotation policy. |
| Operator workstation | Local verification and release preparation. | OWNER TO DEFINE | Local repo access; no production secrets in Git. | Recreate from Git and documented env names. | Current repo verified. | `24213dc` | Backup operator and secure local secret storage policy. |

## Access Loss Rules

- Lost GitHub access blocks push, CI, workflow inspection, and normal release.
- Lost Vercel access blocks deployment, rollback, env inspection, alias changes, and function logs.
- Lost Supabase access blocks database/Auth/storage recovery and most deep incident investigation.
- Lost DNS/registrar access blocks custom-domain recovery.
- Lost owner approval blocks production mutation.

No token, password, key, service-role value, or recovery seed belongs in this file.
