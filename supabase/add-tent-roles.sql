-- Run in Supabase SQL Editor

-- Tent role: is this a veg space, a flower space, or both?
alter table equipment_profiles
  add column if not exists role text not null default 'both';
-- allowed: 'veg' | 'flower' | 'both'

-- Which veg tent a grow lives in before flip. The existing
-- equipment_profile_id is treated as the FLOWER tent (final home).
alter table grows
  add column if not exists veg_tent_id uuid references equipment_profiles(id) on delete set null;
