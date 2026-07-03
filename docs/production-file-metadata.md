# Production File Metadata

Files are stored in Supabase Storage, but production also needs a database row that explains what each file belongs to.

The source of truth for this first contract is `src/fileMetadataModel.js`.

## Why This Exists

The storage path alone is not enough for a CMMS production system.

Production needs to answer:

- which ticket, cleaning complaint, round issue, user, fleet unit, supplier, or system record owns the file;
- what kind of file it is;
- who uploaded it;
- when it was uploaded;
- whether it was deleted;
- which business record should be checked before serving or deleting it.

## Supabase Table

Normalized table: `public.file_metadata`.

Initial fields:

| Field | Meaning |
|---|---|
| `id` | Stable metadata id |
| `owner_type` | Business owner family, such as `ticket` or `cleaning_complaint` |
| `owner_id` | Business owner id |
| `owner_sub_id` | Optional nested owner id, such as a cleaning checklist item |
| `kind` | File purpose, such as `ticket_before_photo` |
| `path` | Supabase Storage object path |
| `content_type` | MIME type |
| `storage_provider` | Storage provider, currently `supabase` |
| `bucket` | Storage bucket, usually `cmms-files` |
| `size_bytes` | Optional file size |
| `created_by_id` | CMMS app user id |
| `created_by_name` | Display name at upload time |
| `created_by_role` | Role at upload time |
| `created_at` | Upload timestamp |
| `deleted_at` | Soft-delete timestamp, if deleted |

## Current Scope

The table and server-only Supabase metadata driver now exist.

Server-only env:

```env
CMMS_FILE_METADATA_DRIVER=supabase
CMMS_FILE_METADATA_SUPABASE_TABLE=file_metadata
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`CMMS_FILE_METADATA_SUPABASE_TABLE` is optional and defaults to `file_metadata`.

The table is created by:

```text
supabase/migrations/20260627201000_file_metadata.sql
```

`/api/files` accepts upload metadata and persists it when the metadata sink is configured. If upload metadata is provided but the sink is not configured, the upload fails with `file_metadata_not_configured` so metadata is not silently lost. If the metadata sink is configured, uploads without metadata fail with `file_metadata_required` so production cannot create orphaned files.

For known protected file owners, upload metadata must also match the storage path owner. For example, `ownerType=ticket` and `ownerId=T-1` must upload under `tickets/T-1/...`, not another ticket path.

Ticket photo uploads now pass explicit file metadata through `/api/files`. Cleaning complaint main photos, cleaning complaint issue photos, and cleaning round issue photos now pass explicit file metadata through `/api/files`.

File deletes through `/api/files` soft-delete matching metadata rows by storage path with `deleted_at` instead of deleting ownership history.

When a metadata lookup sink is configured, `/api/files` download and delete require an active `file_metadata` row for the requested path. The active metadata row must also pass the known owner/path check. This keeps protected file access tied to known business ownership instead of relying only on storage path prefixes.

Do not treat current demo/local backup photos as production migration data.
