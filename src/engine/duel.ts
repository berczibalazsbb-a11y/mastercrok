import { getCard } from '../data/cards';
import type { GameState, PlayerState, DuelResult } from '../types/game';
import type { StatKey } from '../types/card';

/**
 * Effective value of a player's committed card(s) in a given stat, before
 * ability-phase modifiers. Includes:
 *  - the Sensei cross-battle buff (+N to all stats), and
 *  - Captain's Grand Battle (sum of the played card and the extra card).
 *
 * Phase 3 layers ability modifiers (Sumo, Army, Cave, Boy, Karate, …) on top
 * of this via `statModifiers` in the game state reducer.
 */
export function baseValue(player: PlayerState, stat: StatKey): number {
  if (player.committed == null) return -Infinity;
  let value = getCard(player.committed).stats[stat];
  if (player.extraCommitted != null) {
    value += getCard(player.extraCommitted).stats[stat];
  }
  // Note: the Sensei buff is applied into battleMods at battle start, so it is
  // surfaced via effectiveValue, not here.
  return value;
}

/** Compare a precomputed value map for the declared stat. */
export function compareValues(
  values: Record<string, number>,
  stat: StatKey,
  forcedWinnerId: string | null,
): DuelResult {
  const log: string[] = [];

  if (forcedWinnerId) {
    log.push(`${forcedWinnerId} wins via a winning-override ability.`);
    return { stat, winnerId: forcedWinnerId, values, tie: true, log };
  }

  let max = -Infinity;
  for (const v of Object.values(values)) max = Math.max(max, v);
  const leaders = Object.entries(values).filter(([, v]) => v === max);

  if (leaders.length === 1) {
    const [winnerId] = leaders[0];
    log.push(`${winnerId} wins ${stat} with ${max}.`);
    return { stat, winnerId, values, tie: false, log };
  }

  log.push(`Tie on ${stat} at ${max} between ${leaders.map((l) => l[0]).join(', ')}.`);
  return { stat, winnerId: null, values, tie: true, log };
}

/**
 * Resolve a battle from base values only (Phase 2). Phase 3 replaces the value
 * computation with the ability-modified version but reuses `compareValues`.
 */
export function resolveBattle(state: GameState): DuelResult {
  const battle = state.battle!;
  const values: Record<string, number> = {};
  for (const p of state.players) {
    if (p.committed != null) values[p.userId] = baseValue(p, battle.declaredStat);
  }
  return compareValues(values, battle.declaredStat, battle.forcedWinnerId);
}
