-- Run in Supabase SQL Editor
create table if not exists grow_expenses (
  id           uuid         primary key default gen_random_uuid(),
  grow_id      uuid         not null references grows(id) on delete cascade,
  user_id      uuid         not null references profiles(id) on delete cascade,
  expense_date date         not null default current_date,
  category     text         not null default 'other',
  item_name    text         not null,
  amount_usd   numeric(8,2) not null,
  notes        text,
  created_at   timestamptz  not null default now()
);

alter table grow_expenses enable row level security;

create policy "users manage own expenses" on grow_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on grow_expenses (grow_id, expense_date desc);
