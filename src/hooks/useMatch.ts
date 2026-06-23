import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isMyTurn } from '../engine/selectors';
import type { GameState, Move, AbilityPayload } from '../types/game';
import type { StatKey } from '../types/card';

export interface UseMatch {
  state: GameState | null;
  loading: boolean;
  error: string | null;
  myTurn: boolean;
  declareStat: (stat: StatKey) => Promise<void>;
  commitCard: (cardId: number) => Promise<void>;
  commitVakharc: (cardId: number) => Promise<void>;
  useAbility: (payload?: AbilityPayload) => Promise<void>;
  reserveAbility: () => Promise<void>;
  skipAbility: () => Promise<void>;
}

/**
 * Subscribe to a match: fetch the initial state, listen for realtime row
 * updates, and dispatch moves through the `play-move` Edge Function (the
 * server authority). All action helpers send an action; the new state arrives
 * via the realtime subscription.
 */
export function useMatch(matchId: string | null, userId: string | null): UseMatch {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!matchId || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error: e } = await supabase!
        .from('matches')
        .select('state')
        .eq('id', matchId)
        .single();
      if (cancelled) return;
      if (e) setError(e.message);
      else setState((data?.state as GameState) ?? null);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          const next = (payload.new as { state?: GameState }).state;
          if (next) setState(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase!.removeChannel(channel);
    };
  }, [matchId]);

  const send = useCallback(
    async (move: Move) => {
      if (!matchId || !supabase) {
        setError('Not connected to a backend.');
        return;
      }
      if (sending.current) return;
      sending.current = true;
      setError(null);
      try {
        const { data, error: e } = await supabase.functions.invoke('play-move', {
          body: { matchId, move },
        });
        if (e) setError(e.message);
        // Optimistically apply the returned state; realtime will confirm.
        else if (data?.state) setState(data.state as GameState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Move failed.');
      } finally {
        sending.current = false;
      }
    },
    [matchId],
  );

  return {
    state,
    loading,
    error,
    myTurn: !!(state && userId && isMyTurn(state, userId)),
    declareStat: (stat) => send({ type: 'declareStat', stat }),
    commitCard: (cardId) => send({ type: 'commitCard', cardId }),
    commitVakharc: (cardId) => send({ type: 'commitVakharc', cardId }),
    useAbility: (payload) => send({ type: 'useAbility', payload }),
    reserveAbility: () => send({ type: 'reserveAbility' }),
    skipAbility: () => send({ type: 'skipAbility' }),
  };
}
