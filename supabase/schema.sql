-- Weedsmith Full Schema
-- Run this in Supabase SQL Editor
-- If re-running: drop old tables first with the block below

-- ============================================================
-- DROP ALL TABLES (clears any previous schema)
-- ============================================================
drop table if exists recipe_reviews cascade;
drop table if exists harvest_reports cascade;
drop table if exists recipe_ingredients cascade;
drop table if exists recipes cascade;
drop table if exists env_readings cascade;
drop table if exists calendar_events cascade;
drop table if exists feeding_logs cascade;
drop table if exists watering_logs cascade;
drop table if exists journal_entries cascade;
drop table if exists grow_entries cascade;
drop table if exists grows cascade;
drop table if exists equipment_profiles cascade;
drop table if exists genetics cascade;
drop table if exists strains cascade;
drop table if exists harvests cascade;
drop table if exists profiles cascade;
drop function if exists handle_new_user cascade;
drop function if exists update_updated_at cascade;

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  experience_level text check (experience_level in
    ('hobbyist','caregiver','commercial','breeder')),
  location text,
  bio text,
  avatar_url text,
  equipment_profile jsonb default '{}',
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- EQUIPMENT PROFILES
-- ============================================================
create table equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  tent_width_ft numeric,
  tent_length_ft numeric,
  tent_height_ft numeric,
  usable_sqft numeric,
  light_type text,
  light_wattage integer,
  light_brand text,
  medium_type text,
  pot_size_gal numeric,
  max_plants integer,
  controller_type text,
  ac_infinity_device_id text,
  ac_infinity_email text,
  ac_infinity_token text,
  notes text,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- GENETICS
-- ============================================================
create table genetics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  strain_name text not null,
  breeder text,
  type text check (type in ('indica','sativa','hybrid','auto')),
  is_clone_only boolean default false,
  cut_id text,
  mother_id text,
  source text,
  lineage text,
  phenotype_notes text,
  thc_percentage numeric,
  terpene_profile jsonb default '[]',
  is_public boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- GROWS
-- ============================================================
create table grows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  genetics_id uuid references genetics(id) on delete set null,
  equipment_profile_id uuid references equipment_profiles(id) on delete set null,
  status text check (status in (
    'seedling','clone','veg','flower',
    'flush','harvest','drying','curing',
    'complete','failed'
  )) default 'clone' not null,
  medium_type text,
  medium_ingredients jsonb default '[]',
  container_size_gal numeric,
  plant_count integer default 1 not null,
  space_label text,
  clone_date date,
  veg_start_date date,
  flip_date date,
  harvest_date date,
  actual_harvest_date date,
  env_targets jsonb default '{}',
  notes text,
  cover_photo_url text,
  recipe_id uuid,
  is_following_recipe boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- JOURNAL ENTRIES
-- ============================================================
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  entry_date date not null default current_date,
  raw_notes text,
  structured_data jsonb default '{}',
  photos text[] default '{}',
  watering_logged boolean default false,
  feeding_logged boolean default false,
  training_logged boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- WATERING LOGS
-- ============================================================
create table watering_logs (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  log_date date not null default current_date,
  volume_per_plant_ml numeric,
  ph_in numeric check (ph_in between 4.0 and 9.0),
  ec_in numeric check (ec_in between 0 and 10.0),
  additives jsonb default '[]',
  runoff_ph numeric check (runoff_ph between 4.0 and 9.0),
  runoff_ec numeric check (runoff_ec between 0 and 10.0),
  notes text,
  source text check (source in ('manual','ac_infinity','sensor')) default 'manual',
  created_at timestamptz default now()
);

-- ============================================================
-- FEEDING LOGS
-- ============================================================
create table feeding_logs (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  log_date date not null default current_date,
  products jsonb default '[]',
  total_volume_ml numeric,
  ph_in numeric check (ph_in between 4.0 and 9.0),
  ec_in numeric check (ec_in between 0 and 10.0),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  event_date date not null,
  event_type text check (event_type in (
    'water','feed','top_dress','transplant',
    'top','lst','hst','defoliate','trellis',
    'flip','flush_start','harvest','cure_start',
    'clone_take','clone_transplant','observation',
    'environmental_change','custom'
  )) not null,
  title text not null,
  description text,
  completed boolean default false,
  skipped boolean default false,
  completion_notes text,
  completed_at timestamptz,
  is_auto_generated boolean default true,
  priority text check (priority in ('low','medium','high','critical')) default 'medium',
  created_at timestamptz default now()
);

-- ============================================================
-- ENVIRONMENTAL READINGS
-- ============================================================
create table env_readings (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  reading_time timestamptz not null default now(),
  temp_f numeric check (temp_f between 32 and 120),
  temp_c numeric,
  rh_percent numeric check (rh_percent between 0 and 100),
  vpd_kpa numeric,
  co2_ppm numeric,
  ppfd numeric,
  soil_moisture numeric,
  ph numeric check (ph between 4.0 and 9.0),
  ec numeric check (ec between 0 and 10.0),
  source text check (source in ('manual','ac_infinity','aroya','pulse')) default 'manual',
  raw_data jsonb default '{}'
);

-- ============================================================
-- RECIPES
-- ============================================================
create table recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade not null,
  parent_recipe_id uuid references recipes(id) on delete set null,
  fork_notes text,
  title text not null,
  description text,
  version text default '1.0',
  genetics jsonb not null default '{}',
  medium jsonb not null default '{}',
  equipment_requirements jsonb default '{}',
  veg_weeks integer,
  flower_weeks integer,
  total_weeks integer,
  difficulty text check (difficulty in ('beginner','intermediate','advanced','expert')),
  feeding_schedule jsonb default '[]',
  env_schedule jsonb default '[]',
  training_schedule jsonb default '[]',
  watering_schedule jsonb default '[]',
  amendment_schedule jsonb default '[]',
  harvest_data jsonb default '{}',
  ai_summary text,
  key_success_factors text[],
  common_failure_points text[],
  estimated_yield_oz_per_plant numeric,
  is_public boolean default false,
  is_verified boolean default false,
  is_lab_tested boolean default false,
  downloads integer default 0,
  rating_avg numeric default 0,
  rating_count integer default 0,
  cover_photo_url text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add recipe FK to grows now that recipes table exists
alter table grows add constraint grows_recipe_id_fkey
  foreign key (recipe_id) references recipes(id) on delete set null;

-- ============================================================
-- RECIPE REVIEWS
-- ============================================================
create table recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  rating integer check (rating between 1 and 5),
  review_text text,
  yield_achieved_oz numeric,
  verified_grow boolean default false,
  created_at timestamptz default now(),
  unique(recipe_id, user_id)
);

-- ============================================================
-- HARVEST REPORTS
-- ============================================================
create table harvest_reports (
  id uuid primary key default gen_random_uuid(),
  grow_id uuid references grows(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  harvest_date date,
  wet_weight_g numeric,
  dry_weight_g numeric,
  cure_start_date date,
  cure_end_date date,
  thc_percentage numeric,
  cbd_percentage numeric,
  terpene_percentages jsonb default '{}',
  lab_results_url text,
  aroma_notes text,
  effect_notes text,
  overall_rating integer check (overall_rating between 1 and 5),
  would_grow_again boolean,
  notes text,
  photos text[] default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table equipment_profiles enable row level security;
alter table genetics enable row level security;
alter table grows enable row level security;
alter table journal_entries enable row level security;
alter table watering_logs enable row level security;
alter table feeding_logs enable row level security;
alter table calendar_events enable row level security;
alter table env_readings enable row level security;
alter table recipes enable row level security;
alter table recipe_reviews enable row level security;
alter table harvest_reports enable row level security;

-- Profiles
create policy "users view own profile" on profiles for select using (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- Equipment profiles
create policy "users manage own equipment" on equipment_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Genetics (own + public)
create policy "users manage own genetics" on genetics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public genetics readable" on genetics
  for select using (is_public = true);

-- Grows
create policy "users manage own grows" on grows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Journal entries
create policy "users manage own journal" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Watering logs
create policy "users manage own watering" on watering_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Feeding logs
create policy "users manage own feeding" on feeding_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Calendar events
create policy "users manage own calendar" on calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Env readings
create policy "users manage own env readings" on env_readings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recipes (own + public)
create policy "users manage own recipes" on recipes
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "public recipes readable" on recipes
  for select using (is_public = true);

-- Recipe reviews
create policy "users manage own reviews" on recipe_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews readable by all" on recipe_reviews for select using (true);

-- Harvest reports
create policy "users manage own harvests" on harvest_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_recipes_updated_at
  before update on recipes for each row execute function update_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('grow-photos', 'grow-photos', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "users upload own grow photos" on storage.objects;
drop policy if exists "users view own grow photos" on storage.objects;
drop policy if exists "users delete own grow photos" on storage.objects;
drop policy if exists "avatar uploads" on storage.objects;
drop policy if exists "avatars are public" on storage.objects;

create policy "users upload own grow photos" on storage.objects
  for insert with check (bucket_id = 'grow-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users view own grow photos" on storage.objects
  for select using (bucket_id = 'grow-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own grow photos" on storage.objects
  for delete using (bucket_id = 'grow-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatar uploads" on storage.objects
  for insert with check (bucket_id = 'avatars');
create policy "avatars are public" on storage.objects
  for select using (bucket_id = 'avatars');
