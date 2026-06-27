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

## Server API Contract

The first server file API is:

- `POST /api/files?path=tickets/T-001/before.jpg`
  - body: `{ "contentType": "image/jpeg", "data": "<base64 or data-url>" }`
  - requires Supabase user bearer token;
  - stores the file in Supabase Storage using server-only credentials.
- `GET /api/files?path=tickets/T-001/before.jpg`
  - requires Supabase user bearer token;
  - returns `{ "path": "...", "contentType": "...", "data": "<base64>" }`.
- `DELETE /api/files?path=tickets/T-001/before.jpg`
  - requires Supabase user bearer token;
  - deletes the object from Supabase Storage.

Route files:

- `api/files/index.js`
- `api/files/handler.js`
- `api/files/supabaseFileDriver.js`
- `src/apiFileAdapter.js`

The route is closed by default until `CMMS_FILE_DRIVER=supabase`, `CMMS_FILE_BUCKET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are configured.

The frontend adapter is `createApiFileProvider` in `src/apiFileAdapter.js`. It follows the same API URL and Supabase access-token pattern as `src/apiStorageAdapter.js`.

## Next Implementation Step

Move ticket and cleaning photo flows from `photo:*` KV/base64 records to the server file API:

- write only metadata/path references into business records;
- fetch protected image data through `/api/files`;
- stop including production photos inside backup JSON.
