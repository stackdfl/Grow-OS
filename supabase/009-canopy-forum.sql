-- Migration 009 — Canopy forum interactions: posts, comments, votes
-- Run in Supabase SQL Editor.

-- Discussion posts (Strain Talk, Gear, Help, Guides)
create table if not exists community_posts (
  id            uuid        primary key default gen_random_uuid(),
  author_id     uuid        not null references profiles(id) on delete cascade,
  category      text        not null default 'strain_talk', -- strain_talk | gear | help | guides
  title         text        not null,
  body          text        not null default '',
  photos        text[]      not null default '{}',
  upvotes       int         not null default 0,
  comment_count int         not null default 0,
  created_at    timestamptz not null default now()
);
alter table community_posts enable row level security;
create policy "read posts"        on community_posts for select using (true);
create policy "insert own posts"  on community_posts for insert with check (auth.uid() = author_id);
create policy "update own posts"  on community_posts for update using (auth.uid() = author_id);
create policy "delete own posts"  on community_posts for delete using (auth.uid() = author_id);
create index if not exists community_posts_cat_idx on community_posts (category, created_at desc);

-- Comments on a share or a post (one level of threading via parent_id)
create table if not exists community_comments (
  id          uuid        primary key default gen_random_uuid(),
  author_id   uuid        not null references profiles(id) on delete cascade,
  target_type text        not null,  -- share | post
  target_id   uuid        not null,
  parent_id   uuid        references community_comments(id) on delete cascade,
  body        text        not null,
  upvotes     int         not null default 0,
  created_at  timestamptz not null default now()
);
alter table community_comments enable row level security;
create policy "read comments"       on community_comments for select using (true);
create policy "insert own comments" on community_comments for insert with check (auth.uid() = author_id);
create policy "update own comments" on community_comments for update using (auth.uid() = author_id);
create policy "delete own comments" on community_comments for delete using (auth.uid() = author_id);
create index if not exists community_comments_target_idx on community_comments (target_type, target_id, created_at);

-- Upvotes on shares, posts, comments
create table if not exists community_votes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  target_type text        not null,  -- share | post | comment
  target_id   uuid        not null,
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
alter table community_votes enable row level security;
create policy "read votes"       on community_votes for select using (true);
create policy "manage own votes" on community_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- denormalized comment count on shares
alter table community_shares add column if not exists comment_count int not null default 0;
