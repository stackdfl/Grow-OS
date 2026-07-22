-- Run this in Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('grow-photos', 'grow-photos', true)
on conflict (id) do nothing;

create policy "users upload own photos" on storage.objects
  for insert with check (
    bucket_id = 'grow-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users read own photos" on storage.objects
  for select using (
    bucket_id = 'grow-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own photos" on storage.objects
  for delete using (
    bucket_id = 'grow-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
