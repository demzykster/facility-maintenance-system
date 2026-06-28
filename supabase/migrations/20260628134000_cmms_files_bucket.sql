insert into storage.buckets (id, name, public, file_size_limit)
values ('cmms-files', 'cmms-files', false, 10485760)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit;
