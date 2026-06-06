-- Fix the handle_new_user trigger
-- Run this in Supabase SQL Editor

-- Drop and recreate with proper security definer and search path
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  _username text;
  _display_name text;
begin
  -- Get username from metadata, fall back to email prefix, ensure uniqueness
  _username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );
  _display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    _username
  );

  -- Append random suffix if username already taken
  if exists (select 1 from public.profiles where username = _username) then
    _username := _username || '_' || floor(random() * 9000 + 1000)::text;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, _username, _display_name);

  return new;
end;
$$;

-- Recreate the trigger (drop first to avoid duplicate)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
