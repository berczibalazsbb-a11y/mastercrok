// Server-authoritative move validator.
//
// Clients never write game state directly; they POST a move action here. This
// function loads the match, replays the move through the SAME pure engine the
// client uses (src/engine), and persists the new state. The Supabase CLI
// bundles the relative `../../../src/engine` imports (and cards.json) via
// esbuild at deploy time.
//
// Deploy: supabase functions deploy play-move
//
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyMove } from '../../../src/engine/state.ts';
import type { GameState, Move } from '../../../src/types/game.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their JWT.
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let payload: { matchId?: string; move?: Move };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { matchId, move } = payload;
  if (!matchId || !move) return json({ error: 'matchId and move are required' }, 400);

  // Service-role client bypasses RLS for the authoritative write.
  const admin = createClient(url, serviceKey);
  const { data: match, error: loadErr } = await admin
    .from('matches')
    .select('id, state, players, status')
    .eq('id', matchId)
    .single();

  if (loadErr || !match) return json({ error: 'Match not found' }, 404);
  if (!match.state) return json({ error: 'Match has not started' }, 409);
  if (!(match.players as string[]).includes(userId))
    return json({ error: 'You are not in this match' }, 403);

  const result = applyMove(match.state as GameState, move, userId);
  if (!result.ok) return json({ error: result.error }, 422);

  const next = result.state;
  const { error: saveErr } = await admin
    .from('matches')
    .update({
      state: next,
      attacker_index: next.attackerIndex,
      status: next.phase === 'finished' ? 'finished' : 'active',
      winner_id: next.winnerId,
    })
    .eq('id', matchId);

  if (saveErr) return json({ error: saveErr.message }, 500);
  return json({ state: next });
});
