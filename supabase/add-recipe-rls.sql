-- Add public read access for recipes and reviews
-- Run in Supabase SQL Editor

create policy if not exists "public recipes readable" on recipes
  for select using (is_public = true);

create policy if not exists "users manage own reviews" on recipe_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists "reviews readable by authenticated" on recipe_reviews
  for select using (auth.uid() is not null);

-- Allow reading author profiles for public recipes
create policy if not exists "users insert own profile" on profiles
  for insert with check (auth.uid() = id);
