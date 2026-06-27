# Production File Storage

CMMS CDSL currently keeps ticket and cleaning photos as browser/KV strings such as `photo:*` and `photo:after:*`.

That is acceptable for demo/local review, but not for production.

## Production Requirement

Production file/photo storage must use Supabase Storage behind server-side access checks.

Required server env for release readiness:

```env
CMMS_FILE_DRIVER=supabase
CMMS_FILE_BUCKET=cmms-files
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The release gate only accepts production mode when file storage is explicitly configured. This prevents a false production-ready state while photos still rely on browser/KV string storage.

## Current Boundary

- Existing demo/local flows still read and write `photo:*` records through the current store.
- Backup/restore may still include `photos` for demo/local continuity.
- Production rollout must move photo upload/read/delete through server APIs before real use.

## Next Implementation Step

Add a server file API that:

- verifies the Supabase user session;
- stores files in Supabase Storage;
- returns metadata or protected URLs instead of embedding base64 strings in business records;
- enforces access using the same CMMS user/profile/permission model used by `/api/kv`.
