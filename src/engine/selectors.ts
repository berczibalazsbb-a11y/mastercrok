import { getCard } from '../data/cards';
import { canUseAbility } from './abilities';
import type { GameState } from '../types/game';
import type { StatKey } from '../types/card';

/** Player ids who can legally make a move in the current phase. */
export function pendingActors(state: GameState): string[] {
  switch (state.phase) {
    case 'declare':
      return state.battle ? [state.battle.attackerId] : [];
    case 'commit':
    case 'vakharc':
      return state.players.filter((p) => p.committed == null).map((p) => p.userId);
    case 'ability':
      return state.battle ? [state.battle.abilityCursor] : [];
    default:
      return [];
  }
}

export function isMyTurn(state: GameState, userId: string): boolean {
  return pendingActors(state).includes(userId);
}

/** Whether `userId` may use their committed card's ability right now. */
export function canAct(state: GameState, userId: string): boolean {
  return state.phase === 'ability' && canUseAbility(state, userId);
}

export const STAT_OPTIONS: StatKey[] = ['power', 'intelligence', 'reflex'];

/** Human-readable one-line summary of what the game is waiting for. */
export function phaseHint(state: GameState): string {
  const b = state.battle;
  switch (state.phase) {
    case 'declare':
      return `${short(b?.attackerId)} is choosing the battle stat.`;
    case 'commit':
      return 'Players are committing cards face-down.';
    case 'reveal':
      return 'Revealing…';
    case 'ability':
      return `${short(b?.abilityCursor)}'s ability turn (${b?.declaredStat}).`;
    case 'vakharc':
      return 'Vakharc — blind battle.';
    case 'resolve':
      return 'Resolving the battle…';
    case 'finished':
      return state.winnerId ? `${short(state.winnerId)} wins!` : 'Game over.';
    default:
      return '';
  }
}

function short(id?: string | null): string {
  return id ? id.slice(0, 8) : 'someone';
}

export { getCard };
