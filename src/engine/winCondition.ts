import { getCard } from '../data/cards';
import type { GameState, PlayerState } from '../types/game';
import type { GroupSlug } from '../types/card';

export const GROUP_VICTORY_TARGET = 6;

/** Distinct non-null groups present in a player's winner pile. */
export function winnerGroups(player: PlayerState): GroupSlug[] {
  const groups = new Set<GroupSlug>();
  for (const id of player.winners) {
    const g = getCard(id).group;
    if (g) groups.add(g);
  }
  return [...groups];
}

/** Group-victory count = number of distinct groups in the winner pile. */
export function groupVictoryCount(player: PlayerState): number {
  return winnerGroups(player).length;
}

/** A player is out of cards when both deck and hand are empty. */
export function isExhausted(player: PlayerState): boolean {
  return player.deck.length === 0 && player.hand.length === 0;
}

export interface WinCheck {
  finished: boolean;
  winnerId: string | null;
  reason: 'group-victory' | 'alternate-end' | null;
}

/**
 * Check end-of-game conditions after a battle resolves:
 *  - Primary: a player reaches 6 distinct group-victories.
 *  - Alternate: a player has played their last Crok (deck + hand empty);
 *    the player with the most total winners wins.
 */
export function checkWinCondition(state: GameState): WinCheck {
  // Primary — group victory takes precedence.
  let best: { id: string; groups: number } | null = null;
  for (const p of state.players) {
    const g = groupVictoryCount(p);
    if (g >= GROUP_VICTORY_TARGET && (!best || g > best.groups)) {
      best = { id: p.userId, groups: g };
    }
  }
  if (best) {
    return { finished: true, winnerId: best.id, reason: 'group-victory' };
  }

  // Alternate end — someone is out of cards.
  if (state.players.some(isExhausted)) {
    const winner = mostWinners(state.players);
    return { finished: true, winnerId: winner, reason: 'alternate-end' };
  }

  return { finished: false, winnerId: null, reason: null };
}

/** Player with the most total winners; ties broken by group-victory count. */
export function mostWinners(players: PlayerState[]): string {
  let best = players[0];
  for (const p of players.slice(1)) {
    if (
      p.winners.length > best.winners.length ||
      (p.winners.length === best.winners.length &&
        groupVictoryCount(p) > groupVictoryCount(best))
    ) {
      best = p;
    }
  }
  return best.userId;
}
