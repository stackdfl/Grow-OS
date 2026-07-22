-- user_calibrations: one computed profile per user, updated rolling after each log save
create table if not exists user_calibrations (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references profiles(id) on delete cascade,
  calibration_data   jsonb       not null default '{}',
  grow_count         int         not null default 0,
  completed_grows    int         not null default 0,
  last_computed_at   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (user_id)
);

alter table user_calibrations enable row level security;

create policy "users read own calibration" on user_calibrations
  for select using (auth.uid() = user_id);

create policy "users upsert own calibration" on user_calibrations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_calibrations_user_id_idx on user_calibrations (user_id);
