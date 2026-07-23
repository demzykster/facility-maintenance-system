# Daily Health Checklist

Read-only unless an explicit owner-approved incident goal says otherwise.

- [ ] Record timestamp and operator.
- [ ] Check production URL: `https://facility-maintenance-system.vercel.app`.
- [ ] Check version:
  ```bash
  curl -fsS https://facility-maintenance-system.vercel.app/cmms-version.json
  ```
- [ ] Check health:
  ```bash
  curl -fsS https://facility-maintenance-system.vercel.app/api/health
  ```
- [ ] Confirm health status is `ok`.
- [ ] Check latest GitHub Actions `CI` result for `main`.
- [ ] Check latest Vercel production deployment status if Vercel access is available.
- [ ] Review protected system errors only with an authorized session and only when allowed.
- [ ] Review user feedback reports if the current goal permits authenticated read-only checks.
- [ ] Confirm no unresolved critical incident is open.
- [ ] Preserve evidence for any degraded state before changing anything.
