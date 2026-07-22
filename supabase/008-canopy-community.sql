-- Migration 008 — Canopy community: consent-based published snapshots
-- Run in Supabase SQL Editor.
--
-- PRIVACY MODEL: nothing from a grower's private data is ever public.
-- Publishing copies ONLY the chosen fields into community_shares (a frozen
-- snapshot). The community reads community_shares — never the grows table.

create table if not exists community_shares (
  id             uuid        primary key default gen_random_uuid(),
  author_id      uuid        not null references profiles(id) on delete cascade,
  source_grow_id uuid        references grows(id) on delete set null,
  type           text        not null default 'grow_story', -- grow_story | harvest | recipe
  title          text        not null,
  strain_name    text,
  cover_photo    text,
  snapshot       jsonb       not null default '{}',  -- only the consented fields
  upvotes        int         not null default 0,
  created_at     timestamptz not null default now()
);

alter table community_shares enable row level security;

-- Anyone signed in can read the public feed
create policy "read shares" on community_shares
  for select using (true);

-- Authors manage only their own shares
create policy "insert own shares" on community_shares
  for insert with check (auth.uid() = author_id);
create policy "update own shares" on community_shares
  for update using (auth.uid() = author_id);
create policy "delete own shares" on community_shares
  for delete using (auth.uid() = author_id);

create index if not exists community_shares_created_idx on community_shares (created_at desc);
create index if not exists community_shares_author_idx  on community_shares (author_id);

-- Age-gate acknowledgement (21+) before entering Canopy
alter table profiles
  add column if not exists community_acknowledged boolean not null default false;
