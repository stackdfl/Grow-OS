-- Run in Supabase SQL Editor

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;

create policy "users manage own follows"
  on follows for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

create policy "follows are public"
  on follows for select using (true);

-- Index for fast follower/following lookups
create index if not exists follows_follower_id_idx on follows (follower_id);
create index if not exists follows_following_id_idx on follows (following_id);
