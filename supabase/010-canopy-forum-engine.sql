-- Migration 010 — CF1: Forum engine (categories, thread fields, reactions)
-- Run in Supabase SQL Editor.

-- Nested forum categories
create table if not exists forum_categories (
  id           uuid        primary key default gen_random_uuid(),
  parent_id    uuid        references forum_categories(id) on delete cascade,
  slug         text        unique not null,
  name         text        not null,
  description  text,
  icon         text,                 -- lucide icon name
  color        text,                 -- css var or hex
  sort_order   int         not null default 0,
  thread_count int         not null default 0,
  created_at   timestamptz not null default now()
);
alter table forum_categories enable row level security;
create policy "read categories" on forum_categories for select using (true);

-- Thread enhancements on community_posts
alter table community_posts
  add column if not exists category_id       uuid references forum_categories(id) on delete set null,
  add column if not exists prefix            text,
  add column if not exists is_pinned         boolean not null default false,
  add column if not exists is_locked         boolean not null default false,
  add column if not exists solved_comment_id uuid references community_comments(id) on delete set null,
  add column if not exists last_activity_at  timestamptz not null default now();

create index if not exists community_posts_category_idx on community_posts (category_id, is_pinned desc, last_activity_at desc);

-- Reaction type on votes (existing rows default to 'like')
alter table community_votes
  add column if not exists reaction text not null default 'like';

-- Seed categories (idempotent by slug)
insert into forum_categories (slug, name, description, icon, color, sort_order) values
  ('growing',    'Growing',             'Indoor cultivation, environment, training',     'Sprout',        'var(--accent)', 10),
  ('hydro',      'Hydro & Soilless',    'DWC, coco, rockwool, aero',                      'Droplets',      '#38bdf8',       20),
  ('outdoor',    'Outdoor & Greenhouse','Sun-grown, light-dep, greenhouse',               'Sun',           'var(--gold)',   30),
  ('breeding',   'Breeding & Genetics', 'Pheno hunting, crosses, pollen, seed making',    'Dna',           'var(--purple)', 40),
  ('journals',   'Grow Journals',       'Run logs and grow diaries',                      'BookOpen',      'var(--accent)', 50),
  ('extraction', 'Hash & Rosin',        'Solventless, extraction, curing',                'FlaskConical',  'var(--gold)',   60),
  ('strains',    'Strain Talk',         'Reviews, terps, recommendations',                'Leaf',          'var(--accent)', 70),
  ('trading',    'Trading Post',        'Seeds, clones, pollen, gear',                    'Repeat',        '#38bdf8',       80),
  ('help',       'Help & Diagnostics',  'Deficiencies, pests, troubleshooting',           'LifeBuoy',      'var(--warning)',90),
  ('guides',     'Guides & Tutorials',  'How-tos and deep dives',                         'GraduationCap', 'var(--purple)', 100),
  ('gear',       'Gear & Equipment',    'Tents, lights, controllers, setups',             'Wrench',        'var(--text-muted)', 110),
  ('lounge',     'The Lounge',          'Off-topic and community chat',                   'Coffee',        'var(--text-muted)', 120)
on conflict (slug) do nothing;
