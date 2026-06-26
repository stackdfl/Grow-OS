-- Grow OS Schema Migration
-- Run drop-ac-infinity.sql first, then this file.

-- ============================================================
-- TENTS
-- ============================================================
create table if not exists tents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  grow_id uuid references grows(id) on delete set null,
  name text not null,
  api_key text unique not null default gen_random_uuid()::text,
  is_online boolean default false,
  last_seen timestamptz,
  created_at timestamptz default now()
);

alter table tents enable row level security;

create policy "users manage own tents" on tents
  for all using (user_id = auth.uid());

-- ============================================================
-- DEVICE STATES
-- One row per tent (enforced by unique constraint on tent_id)
-- ============================================================
create table if not exists device_states (
  id uuid default gen_random_uuid() primary key,
  tent_id uuid references tents(id) on delete cascade not null unique,
  fan_speed int default 0 check (fan_speed between 0 and 100),
  light_level int default 0 check (light_level between 0 and 100),
  humidifier_on boolean default false,
  clip_fan_1_on boolean default true,
  clip_fan_2_on boolean default true,
  auto_mode boolean default true,
  updated_at timestamptz default now()
);

alter table device_states enable row level security;

create policy "users manage own device states" on device_states
  for all using (
    tent_id in (select id from tents where user_id = auth.uid())
  );

-- ============================================================
-- TENT SCHEDULES
-- One row per tent (enforced by unique constraint on tent_id)
-- ============================================================
create table if not exists tent_schedules (
  id uuid default gen_random_uuid() primary key,
  tent_id uuid references tents(id) on delete cascade not null unique,
  lights_on time default '06:00',
  lights_off time default '18:00',
  sunrise_minutes int default 30,
  sunset_minutes int default 30,
  flower_week int default 1,
  vpd_targets jsonb default '{
    "1":  {"min": 0.8, "max": 1.0},
    "2":  {"min": 0.8, "max": 1.0},
    "3":  {"min": 0.8, "max": 1.0},
    "4":  {"min": 1.0, "max": 1.2},
    "5":  {"min": 1.0, "max": 1.2},
    "6":  {"min": 1.0, "max": 1.2},
    "7":  {"min": 1.2, "max": 1.5},
    "8":  {"min": 1.2, "max": 1.5},
    "9":  {"min": 1.2, "max": 1.5},
    "10": {"min": 1.2, "max": 1.5}
  }',
  updated_at timestamptz default now()
);

alter table tent_schedules enable row level security;

create policy "users manage own tent schedules" on tent_schedules
  for all using (
    tent_id in (select id from tents where user_id = auth.uid())
  );

-- ============================================================
-- MODIFY env_readings
-- ============================================================

-- grow_id becomes nullable: ESP32 readings work even before a grow is linked
alter table env_readings
  alter column grow_id drop not null;

-- Link readings to a tent for realtime filtering
alter table env_readings
  add column if not exists tent_id uuid references tents(id) on delete set null;

-- Expand source check to include grow_os
alter table env_readings
  drop constraint if exists env_readings_source_check;

alter table env_readings
  add constraint env_readings_source_check
  check (source in ('manual', 'ac_infinity', 'aroya', 'pulse', 'grow_os'));

-- Enable realtime for live dashboard subscriptions
-- (Also enable via Supabase dashboard: Database > Replication > Tables > env_readings)
alter publication supabase_realtime add table env_readings;
