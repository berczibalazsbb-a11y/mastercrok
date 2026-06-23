import type { GameState } from '../types/game';
import type { AbilityPayload } from '../types/game';
import type { StatKey } from '../types/card';

/**
 * Ability engine seam.
 *
 * Phase 2 ships these as inert stubs so the core battle flow is fully testable
 * with vanilla stat comparison. Phase 3 implements the real handlers (the
 * clockwise ability loop, immediate effects, swaps, overrides, stat modifiers)
 * behind exactly these function signatures, so the state reducer never changes.
 */

/** Whether `playerId`'s committed card has an ability they may use now. */
export function canUseAbility(_state: GameState, _playerId: string): boolean {
  return false;
}

/** Fire `Azonnal…` (immediate) abilities at reveal, out of turn order. */
export function applyImmediateAbilities(state: GameState): GameState {
  return state;
}

/**
 * Apply a player's ability during the clockwise loop. Returns the new state.
 * Throws on an illegal ability use (caller surfaces the message).
 */
export function applyAbility(
  _state: GameState,
  _playerId: string,
  _payload?: AbilityPayload,
): GameState {
  throw new Error('No ability available to use.');
}

/**
 * Effective value of a player's committed card in the declared stat, including
 * ability-phase modifiers (Sumo, Army, Cave, Boy, Karate, …). Phase 2 returns
 * the base value; Phase 3 layers modifiers.
 */
export function effectiveValue(
  base: number,
  _state: GameState,
  _playerId: string,
  _stat: StatKey,
): number {
  return base;
}
