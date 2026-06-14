create table if not exists public.track_learn_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.track_learn_profiles enable row level security;

grant select, insert, update on public.track_learn_profiles to authenticated;

drop policy if exists "Track Learn owner can read profile" on public.track_learn_profiles;
drop policy if exists "Track Learn owner can insert profile" on public.track_learn_profiles;
drop policy if exists "Track Learn owner can update profile" on public.track_learn_profiles;

create policy "Track Learn owner can read profile"
on public.track_learn_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Track Learn owner can insert profile"
on public.track_learn_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Track Learn owner can update profile"
on public.track_learn_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
