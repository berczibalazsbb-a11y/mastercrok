import type { StatKey } from './card';

export type Phase =
  | 'lobby'
  | 'draw'
  | 'declare'
  | 'commit'
  | 'reveal'
  | 'ability'
  | 'resolve'
  | 'vakharc'
  | 'finished';

export interface PendingBuffs {
  /** Sensei: +N to all stats on this player's next committed Crok. */
  senseiAllStats?: number;
  /** Boy: this player becomes attacker next round. */
  nextRoundAttacker?: boolean;
}

/** Per-battle stat deltas accumulated by abilities used this battle. */
export interface BattleMods {
  power: number;
  intelligence: number;
  reflex: number;
}

export function zeroMods(): BattleMods {
  return { power: 0, intelligence: 0, reflex: 0 };
}

export interface PlayerState {
  userId: string;
  /** Card ids; top of deck = index 0. Server-authoritative order. */
  deck: number[];
  /** Card ids in hand. */
  hand: number[];
  /** Card committed face-down for the current battle. */
  committed: number | null;
  /** Extra card revealed for Captain Crok's Grand Battle, if any. */
  extraCommitted: number | null;
  /** Winner pile (card ids). Group-victory count is derived from this. */
  winners: number[];
  /** Loser pile (card ids). */
  losers: number[];
  pendingBuffs: PendingBuffs;
  /** Stat deltas from abilities used this battle (reset each battle). */
  battleMods: BattleMods;
  /** Used their ability this battle (used or permanently declined). */
  abilityUsed: boolean;
  /** Reserved (tartalékolás) — earns another pass this battle. */
  abilityReserved: boolean;
}

export interface BattleState {
  declaredStat: StatKey;
  attackerId: string;
  /** Whose turn it is in the clockwise ability loop. */
  abilityCursor: string;
  /** Priest: groups whose abilities are nullified this battle. */
  nullifiedGroups: string[];
  /** Samurai: specific player ids whose abilities are nullified this battle. */
  nullifiedPlayers: string[];
  /** Sheriff: a winning-override has been claimed by this player. */
  forcedWinnerId: string | null;
  /** Captain: Grand Battle active (sum of two cards' stat). */
  grandBattle: boolean;
  /** Executor: waiting for the targeted player to choose which hand card to discard. */
  pendingVictimDiscard: { executorPlayerId: string; targetPlayerId: string } | null;
  log: string[];
}

export interface GameState {
  matchId: string;
  /** Clockwise seating; players[0] is the original attacker. */
  players: PlayerState[];
  attackerIndex: number;
  phase: Phase;
  battle: BattleState | null;
  /** Recursive tie nesting depth. */
  vakharcDepth: number;
  /** Pancrator: force next battle to start as a Vakharc. */
  forcedNextVakharc: { byPlayerId: string } | null;
  seed: number;
  winnerId: string | null;
  /** Optimistic-concurrency / stale-write guard. */
  version: number;
}

export type AbilityPayload = {
  /** Target player for targeted abilities (Executor, Funny, Devil, Cave). */
  targetPlayerId?: string;
  /** Target card id (Master swap, Angel recover, Karate sacrifice, etc.). */
  cardId?: number;
  /** Stat choice (Bond change-stat). */
  stat?: StatKey;
  /** Priest: choose 'nullify' or 'draw'. */
  choice?: 'nullify' | 'draw';
  /** Indian: new order of the scried top-of-deck cards. */
  order?: number[];
};

export type Move =
  | { type: 'declareStat'; stat: StatKey }
  | { type: 'commitCard'; cardId: number }
  | { type: 'useAbility'; payload?: AbilityPayload }
  | { type: 'reserveAbility' }
  | { type: 'skipAbility' }
  | { type: 'resolve' }
  | { type: 'commitVakharc'; cardId: number }
  | { type: 'chooseDiscard'; cardId: number };

export interface DuelResult {
  stat: StatKey;
  /** Winner of the battle, or null on a tie. */
  winnerId: string | null;
  /** Effective stat value per player after modifiers. */
  values: Record<string, number>;
  tie: boolean;
  log: string[];
}

/** Result of applying a move: either a new state or a validation error. */
export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
