import { getCard } from '../data/cards';
import { mulberry32, shuffle } from './rng';
import { baseValue, compareValues } from './duel';
import { checkWinCondition } from './winCondition';
import {
  canUseAbility,
  applyImmediateAbilities,
  applyAbility,
  effectiveValue,
} from './abilities';
import { zeroMods } from '../types/game';
import type {
  GameState,
  PlayerState,
  Move,
  ApplyResult,
  BattleState,
} from '../types/game';

export const STARTING_HAND = 4;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyPlayer(userId: string, deck: number[]): PlayerState {
  return {
    userId,
    deck,
    hand: [],
    committed: null,
    extraCommitted: null,
    winners: [],
    losers: [],
    pendingBuffs: {},
    battleMods: zeroMods(),
    abilityUsed: false,
    abilityReserved: false,
  };
}

function freshBattle(attackerId: string): BattleState {
  return {
    declaredStat: 'power',
    attackerId,
    abilityCursor: attackerId,
    nullifiedGroups: [],
    nullifiedPlayers: [],
    forcedWinnerId: null,
    grandBattle: false,
    log: [],
  };
}

/**
 * Create a new game. `decks` are parallel to `playerIds`. Decks are shuffled
 * deterministically from `seed`; the first attacker is chosen from the seed too.
 */
export function createGame(
  matchId: string,
  playerIds: string[],
  decks: number[][],
  seed: number,
): GameState {
  const rng = mulberry32(seed);
  const players = playerIds.map((id, i) =>
    emptyPlayer(id, shuffle(decks[i], rng)),
  );

  // Initial draw of 4.
  for (const p of players) {
    p.hand = p.deck.slice(0, STARTING_HAND);
    p.deck = p.deck.slice(STARTING_HAND);
  }

  const attackerIndex = Math.floor(rng() * players.length);

  const state: GameState = {
    matchId,
    players,
    attackerIndex,
    phase: 'declare',
    battle: null,
    vakharcDepth: 0,
    forcedNextVakharc: null,
    seed,
    winnerId: null,
    version: 0,
  };

  startBattle(state, attackerIndex);
  return state;
}

function playerIndex(state: GameState, userId: string): number {
  return state.players.findIndex((p) => p.userId === userId);
}

function lastDefenderIndex(state: GameState, attackerIndex: number): number {
  // Clockwise from the attacker, the last defender is the seat immediately
  // before the attacker.
  return (attackerIndex - 1 + state.players.length) % state.players.length;
}

/** Begin a normal battle: reset, draw 1, attacker declares. */
function startBattle(state: GameState, attackerIndex: number): void {
  // Boy Crok: a pending next-round-attacker override.
  const override = state.players.findIndex((p) => p.pendingBuffs.nextRoundAttacker);
  if (override >= 0) {
    attackerIndex = override;
    state.players[override].pendingBuffs.nextRoundAttacker = false;
  }

  state.attackerIndex = attackerIndex;

  for (const p of state.players) {
    p.committed = null;
    p.extraCommitted = null;
    p.abilityUsed = false;
    p.abilityReserved = false;
    p.battleMods = zeroMods();
    if (p.deck.length > 0) {
      p.hand.push(p.deck.shift()!);
    }
  }

  // Pancrator: the next battle is forced to start as a Vakharc.
  if (state.forcedNextVakharc) {
    const idx = playerIndex(state, state.forcedNextVakharc.byPlayerId);
    state.forcedNextVakharc = null;
    enterVakharc(state, idx >= 0 ? idx : attackerIndex);
    return;
  }

  state.battle = freshBattle(state.players[attackerIndex].userId);
  state.phase = 'declare';
}

/** Begin a Vakharc (blind battle) after a tie or a Pancrator trigger. */
function enterVakharc(state: GameState, attackerIndex: number): void {
  state.vakharcDepth += 1;
  state.attackerIndex = attackerIndex;
  state.battle = freshBattle(state.players[attackerIndex].userId);

  for (const p of state.players) {
    p.committed = null;
    p.extraCommitted = null;
    p.abilityUsed = false;
    p.abilityReserved = false;
    p.battleMods = zeroMods();
    // Players with a deck place their top card face-down automatically.
    if (p.deck.length > 0) {
      p.committed = p.deck.shift()!;
    }
    // Empty-deck players choose from hand via `commitVakharc`.
  }

  state.phase = allCommitted(state) ? 'declare' : 'vakharc';
}

function allCommitted(state: GameState): boolean {
  return state.players.every((p) => p.committed != null);
}

/** After everyone has committed: reveal, fire immediate abilities, loop. */
function afterAllCommitted(state: GameState): void {
  state.phase = 'reveal';
  Object.assign(state, applyImmediateAbilities(state));
  enterAbilityPhase(state);
}

function enterAbilityPhase(state: GameState): void {
  state.phase = 'ability';
  state.battle!.abilityCursor = state.players[state.attackerIndex].userId;
  advanceAbilityLoop(state);
}

/**
 * Advance the clockwise ability loop. Stops (waiting for a move) when the
 * cursor lands on a player with a usable ability; otherwise auto-skips. When
 * every player has permanently declined, resolves the battle.
 */
function advanceAbilityLoop(state: GameState): void {
  const n = state.players.length;
  let cursorIdx = playerIndex(state, state.battle!.abilityCursor);

  for (let steps = 0; steps < n * 2; steps++) {
    const player = state.players[cursorIdx];
    if (!player.abilityUsed) {
      if (canUseAbility(state, player.userId)) {
        state.battle!.abilityCursor = player.userId;
        return; // wait for the player's move
      }
      player.abilityUsed = true; // auto-skip: no usable ability
    }
    cursorIdx = (cursorIdx + 1) % n;
    if (state.players.every((p) => p.abilityUsed)) {
      doResolve(state);
      return;
    }
  }
  doResolve(state);
}

/** Resolve the battle, distribute piles, check win, start the next battle. */
function doResolve(state: GameState): void {
  state.phase = 'resolve';
  const battle = state.battle!;
  const stat = battle.declaredStat;

  const values: Record<string, number> = {};
  for (const p of state.players) {
    if (p.committed != null) {
      values[p.userId] = effectiveValue(baseValue(p, stat), state, p.userId, stat);
    }
  }
  const result = compareValues(values, stat, battle.forcedWinnerId);
  battle.log.push(...result.log);

  // Pancrator (afterBattle): if a Pancrator loses, the next battle is a Vakharc
  // chosen by its owner. Captured before committed cards are cleared.
  for (const p of state.players) {
    if (
      p.committed != null &&
      getCard(p.committed).ability.archetype === 'trigger-vakharc-on-loss' &&
      p.userId !== result.winnerId
    ) {
      state.forcedNextVakharc = { byPlayerId: p.userId };
      battle.log.push(`${p.userId}'s Pancrator forces a Vakharc next battle.`);
    }
  }

  if (result.winnerId && !result.tie) {
    // Clean win: winner keeps their card; everyone else loses theirs.
    for (const p of state.players) {
      if (p.committed == null) continue;
      if (p.userId === result.winnerId) {
        p.winners.push(p.committed);
      } else {
        p.losers.push(p.committed);
      }
      if (p.extraCommitted != null) p.losers.push(p.extraCommitted);
      p.committed = null;
      p.extraCommitted = null;
      p.pendingBuffs.senseiAllStats = 0;
    }
    finishOrContinue(state, result.winnerId);
  } else if (result.winnerId && result.tie) {
    // Winning-override (Sheriff on a tie): owner wins, others lose.
    for (const p of state.players) {
      if (p.committed == null) continue;
      if (p.userId === result.winnerId) p.winners.push(p.committed);
      else p.losers.push(p.committed);
      if (p.extraCommitted != null) p.losers.push(p.extraCommitted);
      p.committed = null;
      p.extraCommitted = null;
      p.pendingBuffs.senseiAllStats = 0;
    }
    finishOrContinue(state, result.winnerId);
  } else {
    // True tie: every battling Crok goes to its owner's loser pile → Vakharc.
    const tiedAttackerIndex = state.attackerIndex;
    for (const p of state.players) {
      if (p.committed != null) p.losers.push(p.committed);
      if (p.extraCommitted != null) p.losers.push(p.extraCommitted);
      p.committed = null;
      p.extraCommitted = null;
      p.pendingBuffs.senseiAllStats = 0;
    }
    const win = checkWinCondition(state);
    if (win.finished) {
      state.phase = 'finished';
      state.winnerId = win.winnerId;
      return;
    }
    enterVakharc(state, lastDefenderIndex(state, tiedAttackerIndex));
  }
}

function finishOrContinue(state: GameState, winnerId: string): void {
  const win = checkWinCondition(state);
  if (win.finished) {
    state.phase = 'finished';
    state.winnerId = win.winnerId;
    return;
  }
  state.vakharcDepth = 0;
  startBattle(state, playerIndex(state, winnerId));
}

// --- Public reducer ---------------------------------------------------------

function err(error: string): ApplyResult {
  return { ok: false, error };
}

/**
 * Apply a move on behalf of `byPlayerId`. Pure: returns a new state (the input
 * is never mutated) or a validation error. This is the single source of truth
 * used by both the client (optimistic) and the `play-move` Edge Function.
 */
export function applyMove(
  state: GameState,
  move: Move,
  byPlayerId: string,
): ApplyResult {
  const draft = clone(state);
  const me = draft.players.find((p) => p.userId === byPlayerId);
  if (!me) return err('You are not in this match.');
  if (draft.phase === 'finished') return err('The game is over.');

  switch (move.type) {
    case 'declareStat': {
      if (draft.phase !== 'declare') return err('Not the declare phase.');
      if (draft.battle!.attackerId !== byPlayerId)
        return err('Only the attacker may declare the stat.');
      draft.battle!.declaredStat = move.stat;
      if (allCommitted(draft)) {
        // Vakharc: cards already committed → straight to reveal.
        afterAllCommitted(draft);
      } else {
        draft.phase = 'commit';
      }
      break;
    }

    case 'commitCard': {
      if (draft.phase !== 'commit') return err('Not the commit phase.');
      if (me.committed != null) return err('You already committed a card.');
      const idx = me.hand.indexOf(move.cardId);
      if (idx < 0) return err('That card is not in your hand.');
      me.committed = me.hand.splice(idx, 1)[0];
      if (allCommitted(draft)) afterAllCommitted(draft);
      break;
    }

    case 'commitVakharc': {
      if (draft.phase !== 'vakharc') return err('Not the Vakharc phase.');
      if (me.committed != null) return err('You already committed a card.');
      if (me.deck.length > 0) return err('Vakharc auto-commits from your deck.');
      const idx = me.hand.indexOf(move.cardId);
      if (idx < 0) return err('That card is not in your hand.');
      me.committed = me.hand.splice(idx, 1)[0];
      if (allCommitted(draft)) draft.phase = 'declare';
      break;
    }

    case 'useAbility': {
      if (draft.phase !== 'ability') return err('Not the ability phase.');
      if (draft.battle!.abilityCursor !== byPlayerId)
        return err('It is not your ability turn.');
      try {
        Object.assign(draft, applyAbility(draft, byPlayerId, move.payload));
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Illegal ability use.');
      }
      me.abilityUsed = true;
      me.abilityReserved = false;
      advanceAbilityLoop(draft);
      break;
    }

    case 'reserveAbility': {
      if (draft.phase !== 'ability') return err('Not the ability phase.');
      if (draft.battle!.abilityCursor !== byPlayerId)
        return err('It is not your ability turn.');
      if (me.winners.length === 0)
        return err('Reserving costs a winning Crok, but you have none.');
      me.losers.push(me.winners.pop()!); // reserve cost
      me.abilityReserved = true;
      // Reserved players are revisited; advance cursor without marking used.
      {
        const n = draft.players.length;
        const cur = playerIndex(draft, byPlayerId);
        draft.battle!.abilityCursor = draft.players[(cur + 1) % n].userId;
      }
      advanceAbilityLoop(draft);
      break;
    }

    case 'skipAbility': {
      if (draft.phase !== 'ability') return err('Not the ability phase.');
      if (draft.battle!.abilityCursor !== byPlayerId)
        return err('It is not your ability turn.');
      me.abilityUsed = true;
      advanceAbilityLoop(draft);
      break;
    }

    case 'resolve': {
      if (draft.phase !== 'ability') return err('Nothing to resolve now.');
      doResolve(draft);
      break;
    }

    default:
      return err('Unknown move.');
  }

  draft.version = state.version + 1;
  return { ok: true, state: draft };
}

// Re-export helpers used by the data-binding sanity check / tests.
export { getCard };
