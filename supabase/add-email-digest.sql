-- Run in Supabase SQL Editor
alter table profiles
  add column if not exists email_digest_enabled boolean not null default false;
