-- Profiles: one row per auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  wins int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public player profiles, keyed to auth.users.';
