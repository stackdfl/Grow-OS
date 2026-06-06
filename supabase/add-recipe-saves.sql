-- Personal recipe library: tracks which recipes a user has saved from the board
create table if not exists recipe_saves (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id)  on delete cascade,
  recipe_id  uuid        not null references recipes(id)   on delete cascade,
  saved_at   timestamptz not null    default now(),
  unique (user_id, recipe_id)
);

alter table recipe_saves enable row level security;

create policy "users manage own saves"
  on recipe_saves for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
