-- Row Level Security.

alter table public.profiles enable row level security;
alter table public.matches enable row level security;

-- Profiles: world-readable (for lobby/usernames); self-write only.
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all"
  on public.profiles for select using (true);

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
  on public.profiles for update using (auth.uid() = id);

-- Matches:
--  - players in the match can read it
--  - anyone authenticated can read a 'waiting' match (to preview/join via link)
drop policy if exists "matches read" on public.matches;
create policy "matches read"
  on public.matches for select
  using (
    auth.uid() = any (players)
    or status = 'waiting'
  );

--  - the host creates the match (and must be a player)
drop policy if exists "matches insert host" on public.matches;
create policy "matches insert host"
  on public.matches for insert
  with check (auth.uid() = host_id and auth.uid() = any (players));

--  - players may update their own match; a 'waiting' match may be updated by
--    any authenticated user (so a second player can join by adding themselves).
drop policy if exists "matches update" on public.matches;
create policy "matches update"
  on public.matches for update
  using (auth.uid() = any (players) or status = 'waiting');

-- NOTE: Authoritative game-state transitions go through the `play-move` Edge
-- Function (service role), which validates each move with the shared engine.
-- Direct client UPDATEs are intended only for joining/lobby metadata.
