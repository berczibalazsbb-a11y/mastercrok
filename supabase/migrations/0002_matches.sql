-- Matches: each row holds the full game state as JSONB.
do $$ begin
  create type public.match_status as enum ('waiting', 'active', 'finished');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  -- Ordered clockwise; players[0] is the original attacker seat.
  players uuid[] not null default '{}',
  status public.match_status not null default 'waiting',
  attacker_index int not null default 0,
  -- Full GameState blob (see src/types/game.ts).
  state jsonb,
  winner_id uuid references public.profiles (id),
  -- Shareable join code for the invite-link flow.
  invite_code text unique not null,
  host_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_invite_code_idx on public.matches (invite_code);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.touch_updated_at();

-- Realtime: broadcast row changes to subscribed clients.
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception
  when duplicate_object then null;
end $$;
