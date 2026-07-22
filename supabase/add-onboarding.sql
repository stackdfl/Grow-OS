-- Run in Supabase SQL Editor
alter table profiles
  add column if not exists onboarding_completed boolean not null default false;
