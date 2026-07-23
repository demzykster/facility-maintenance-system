# Platform Portability Checklist

Use this checklist before any non-Vercel hosting experiment. It is read-only until the owner explicitly approves a target rollout.

## Baseline

- [ ] Confirm `HEAD`, `origin/main`, and deployed SHA.
- [ ] Confirm working tree is clean.
- [ ] Confirm production `/api/health` is `ok`.
- [ ] Confirm `/cmms-version.json` matches the expected SHA.
- [ ] Record Node and npm versions.
- [ ] Do not change Vercel, DNS, env, Supabase, users, permissions, schema, or data.

## Repository Verification

- [ ] Run `npm run platform:verify -- --target=vercel`.
- [ ] Run the target simulation, for example `npm run platform:verify -- --target=cloud-run`.
- [ ] Confirm readiness runs did not use `--skip-build`.
- [ ] Confirm the verifier reports `build.attempted=true` and `build.ok=true` for any target being treated as ready.
- [ ] Confirm non-Vercel targets are not marked `READY` unless a production API adapter exists.
- [ ] Confirm Vercel tooling references are not treated as runtime blockers.
- [ ] Confirm no secret values are printed.
- [ ] Confirm no deployment/write commands are executed.

## Runtime Requirements

- [ ] Static assets build with `npm run build`.
- [ ] `/api/*` route handling exists for the target platform.
- [ ] SPA fallback is implemented.
- [ ] `/manifest.webmanifest` maps to the manifest handler or an equivalent static artifact.
- [ ] Security headers from `vercel.json` are replicated.
- [ ] `/api/health` is reachable.
- [ ] `/cmms-version.json` exposes the expected commit.
- [ ] `NODE_ENV=production` is set.
- [ ] `CMMS_BUILD_COMMIT` or an equivalent neutral SHA value is set.

## Environment

- [ ] Runtime secrets are configured by name on the target platform.
- [ ] Public build-time vars are configured before build.
- [ ] Provider keys are present only when AI mode requires them.
- [ ] Supabase URL, anon key, service-role key, and session secret are configured securely.
- [ ] No secret values are logged or committed.
- [ ] Vercel-specific names are replaced or made optional where needed.

## Proxy and Security

- [ ] HTTPS is terminated before user traffic reaches the app.
- [ ] Secure cookies are preserved.
- [ ] `Host`, `Cookie`, and `Set-Cookie` headers survive the proxy.
- [ ] `x-forwarded-for` is trusted only from the configured proxy boundary.
- [ ] Same-origin `/api/*` calls work from the frontend.
- [ ] Authenticated and unauthenticated API behavior matches Vercel.

## Storage

- [ ] Supabase-backed data drivers work.
- [ ] Supabase file storage works.
- [ ] No product runtime path requires persistent local disk.
- [ ] Read-only filesystem works except for platform temp needs.
- [ ] Local tooling outputs are not confused with product storage.

## Validation

- [ ] `npm test -- --run` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm run project:harness:check` passes.
- [ ] `npm run release:check` passes.
- [ ] `git diff --check` passes.
- [ ] Read-only health/version/auth checks pass on the candidate.
- [ ] Owner-approved authenticated smoke passes before cutover.

## Stop Conditions

- [ ] Stop if no production API adapter exists for the target.
- [ ] Stop if health/version endpoints fail.
- [ ] Stop if auth cookies are insecure or ambiguous behind proxy.
- [ ] Stop if required env cannot be mapped safely.
- [ ] Stop if filesystem persistence is required.
- [ ] Stop if target migration would require Supabase security rewrites.
- [ ] Stop if owner has not selected the target platform.
