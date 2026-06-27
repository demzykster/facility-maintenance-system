# Production File Storage

CMMS CDSL keeps demo/local photos as browser/KV strings such as `photo:*` and inline cleaning photo fields.

That is acceptable for demo/local review, but not for production.

## Production Requirement

Production file/photo storage must use Supabase Storage behind server-side access checks.

Required server env for release readiness:

```env
CMMS_FILE_DRIVER=supabase
CMMS_FILE_BUCKET=cmms-files
CMMS_FILE_METADATA_DRIVER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The release gate only accepts production mode when file storage and file ownership metadata storage are explicitly configured. This prevents a false production-ready state while photos still rely on browser/KV string storage or upload without durable ownership rows.

## Current Boundary

- Existing demo/local flows still read and write the current browser/KV photo records for review compatibility.
- Production+API ticket before/after photos use `/api/files` and ticket metadata fields (`photoPath`, `afterPhotoPath`).
- Production+API cleaning complaint and round issue photos use `/api/files` and metadata fields (`photoPath`, `hasPhoto`).
- Backup/restore may still include `photos` for demo/local continuity.
- Production rollout must keep protected file access behind server APIs before real use.

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

## Metadata Contract

Protected file bytes live in Supabase Storage. Their business ownership belongs in a future `file_metadata` database table.

The first shared metadata contract is documented in `docs/production-file-metadata.md`, modeled in `src/fileMetadataModel.js`, and backed by `api/files/supabaseFileMetadataDriver.js`.

## Next Implementation Step

Finish the production file boundary around backup/export and future normalized tables:

- keep production business records as metadata/path references, not embedded base64;
- persist file ownership metadata server-side when upload flows are moved fully behind Supabase tables/RLS;
- keep protected image data fetched through `/api/files`;
- avoid treating demo/local backup photos as production migration data.
