import { supabase } from './supabaseClient';
import { createGame } from '../engine/state';

/** MVP default deck: one of each card (21 cards, all legal). */
export const DEFAULT_DECK: number[] = Array.from({ length: 21 }, (_, i) => i + 1);

export function makeInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export interface MatchRow {
  id: string;
  players: string[];
  status: 'waiting' | 'active' | 'finished';
  invite_code: string;
  host_id: string;
}

function db() {
  if (!supabase) throw new Error('Backend not configured.');
  return supabase;
}

export async function createMatch(hostId: string): Promise<MatchRow> {
  const invite = makeInviteCode();
  const { data, error } = await db()
    .from('matches')
    .insert({
      players: [hostId],
      host_id: hostId,
      status: 'waiting',
      invite_code: invite,
      attacker_index: 0,
      state: null,
    })
    .select('id, players, status, invite_code, host_id')
    .single();
  if (error) throw error;
  return data as MatchRow;
}

export async function findByCode(code: string): Promise<MatchRow | null> {
  const { data } = await db()
    .from('matches')
    .select('id, players, status, invite_code, host_id')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle();
  return (data as MatchRow) ?? null;
}

export async function joinMatch(matchId: string, userId: string): Promise<void> {
  const { data, error } = await db()
    .from('matches')
    .select('players, status')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  if (data.status !== 'waiting') throw new Error('Match already started.');
  const players: string[] = data.players ?? [];
  if (players.includes(userId)) return;
  const { error: uErr } = await db()
    .from('matches')
    .update({ players: [...players, userId] })
    .eq('id', matchId);
  if (uErr) throw uErr;
}

/** Host starts the game: build decks, create the initial GameState, persist. */
export async function startMatch(matchId: string, playerIds: string[]): Promise<void> {
  if (playerIds.length < 2) throw new Error('Need at least 2 players.');
  const seed = Math.floor(Math.random() * 0xffffffff);
  const decks = playerIds.map(() => [...DEFAULT_DECK]);
  const state = createGame(matchId, playerIds, decks, seed);
  const { error } = await db()
    .from('matches')
    .update({ state, status: 'active', attacker_index: state.attackerIndex })
    .eq('id', matchId);
  if (error) throw error;
}
