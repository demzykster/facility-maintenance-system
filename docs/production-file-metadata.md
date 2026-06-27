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

## Future Table

Future normalized table: `file_metadata`.

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

This is a contract/model step only.

Current upload flows already store protected file bytes through `/api/files` in production+API mode. The next production step is to persist matching metadata rows server-side when uploads happen.

Do not treat current demo/local backup photos as production migration data.
