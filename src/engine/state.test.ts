import { describe, it, expect } from 'vitest';
import { createGame, applyMove, STARTING_HAND } from './state';
import { groupVictoryCount } from './winCondition';
import type { GameState, PlayerState } from '../types/game';

function legalDeck(start: number): number[] {
  // 10 distinct cards starting from `start`, wrapping 1..21.
  return Array.from({ length: 10 }, (_, i) => ((start + i - 1) % 21) + 1);
}

function mkPlayer(userId: string, over: Partial<PlayerState> = {}): PlayerState {
  return {
    userId,
    deck: [],
    hand: [],
    committed: null,
    extraCommitted: null,
    winners: [],
    losers: [],
    pendingBuffs: {},
    battleMods: { power: 0, intelligence: 0, reflex: 0 },
    abilityUsed: false,
    abilityReserved: false,
    ...over,
  };
}

function expectOk(r: ReturnType<typeof applyMove>): GameState {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r.state;
}

/** Skip every ability so a battle resolves on vanilla stats. */
function skipAbilities(g: GameState): GameState {
  let guard = 0;
  while (g.phase === 'ability' && guard++ < 50) {
    g = expectOk(applyMove(g, { type: 'skipAbility' }, g.battle!.abilityCursor));
  }
  return g;
}

describe('createGame', () => {
  it('deals 4 + draws 1 for the first battle and is ready to declare', () => {
    const g = createGame('m1', ['a', 'b'], [legalDeck(1), legalDeck(5)], 42);
    expect(g.phase).toBe('declare');
    // 4 dealt + 1 drawn at battle start.
    for (const p of g.players) expect(p.hand).toHaveLength(STARTING_HAND + 1);
    expect(g.battle).not.toBeNull();
    expect(g.battle!.attackerId).toBe(g.players[g.attackerIndex].userId);
  });
});

describe('battle flow (vanilla, abilities stubbed)', () => {
  it('runs a full 2-player game to a finished state', () => {
    let g = createGame('m2', ['a', 'b'], [legalDeck(1), legalDeck(3)], 7);
    let guard = 0;
    while (g.phase !== 'finished' && guard++ < 500) {
      if (g.phase === 'declare') {
        const atk = g.players[g.attackerIndex].userId;
        g = expectOk(applyMove(g, { type: 'declareStat', stat: 'power' }, atk));
      }
      for (const p of g.players) {
        if (g.phase === 'commit' && p.committed == null) {
          g = expectOk(applyMove(g, { type: 'commitCard', cardId: p.hand[0] }, p.userId));
        }
      }
      if (g.phase === 'vakharc') {
        for (const p of g.players) {
          if (p.committed == null && p.hand.length) {
            g = expectOk(applyMove(g, { type: 'commitVakharc', cardId: p.hand[0] }, p.userId));
          }
        }
      }
      g = skipAbilities(g);
    }
    expect(g.phase).toBe('finished');
    expect(g.winnerId).not.toBeNull();
  });

  it('a clean win sends winner card to winners, loser card to losers', () => {
    // Construct a commit-phase state: a plays Sumo (power 8), b plays Bond (5).
    const g: GameState = {
      matchId: 'm3',
      players: [
        mkPlayer('a', { hand: [10], deck: [1, 2] }), // Sumo
        mkPlayer('b', { hand: [2], deck: [3, 4] }), // Bond
      ],
      attackerIndex: 0,
      phase: 'commit',
      battle: {
        declaredStat: 'power',
        attackerId: 'a',
        abilityCursor: 'a',
        nullifiedGroups: [],
        nullifiedPlayers: [],
        forcedWinnerId: null,
        grandBattle: false,
        log: [],
      },
      vakharcDepth: 0,
      forcedNextVakharc: null,
      seed: 1,
      winnerId: null,
      version: 0,
    };
    let s = expectOk(applyMove(g, { type: 'commitCard', cardId: 10 }, 'a'));
    s = expectOk(applyMove(s, { type: 'commitCard', cardId: 2 }, 'b'));
    s = skipAbilities(s);
    const a = s.players.find((p) => p.userId === 'a')!;
    const b = s.players.find((p) => p.userId === 'b')!;
    expect(a.winners).toContain(10);
    expect(b.losers).toContain(2);
    // Winner becomes next attacker.
    expect(s.players[s.attackerIndex].userId).toBe('a');
  });

  it('a tie sends all cards to losers and enters Vakharc', () => {
    // Both play a power-3 card (Angel #5 vs Indian #17).
    const g: GameState = {
      matchId: 'm4',
      players: [
        mkPlayer('a', { hand: [5], deck: [1, 2] }),
        mkPlayer('b', { hand: [17], deck: [3, 4] }),
      ],
      attackerIndex: 0,
      phase: 'commit',
      battle: {
        declaredStat: 'power',
        attackerId: 'a',
        abilityCursor: 'a',
        nullifiedGroups: [],
        nullifiedPlayers: [],
        forcedWinnerId: null,
        grandBattle: false,
        log: [],
      },
      vakharcDepth: 0,
      forcedNextVakharc: null,
      seed: 1,
      winnerId: null,
      version: 0,
    };
    let s = expectOk(applyMove(g, { type: 'commitCard', cardId: 5 }, 'a'));
    s = expectOk(applyMove(s, { type: 'commitCard', cardId: 17 }, 'b'));
    s = skipAbilities(s);
    expect(s.players[0].losers).toContain(5);
    expect(s.players[1].losers).toContain(17);
    expect(s.vakharcDepth).toBe(1);
    // Vakharc auto-committed the deck tops; attacker is the last defender (b).
    expect(['declare', 'vakharc']).toContain(s.phase);
    expect(s.players[s.attackerIndex].userId).toBe('b');
  });
});

describe('win conditions', () => {
  it('declares a group-victory at 6 distinct groups', () => {
    // a already has 5 distinct groups won; winning a 6th distinct group ends it.
    // Winners: Bond(spy#2), Devil(devil#3), Samurai(yinyang#4), Angel(angel#5),
    //          Captain(pirate#6). Now win Jungle(jungle#8) for the 6th group.
    const g: GameState = {
      matchId: 'm5',
      players: [
        mkPlayer('a', { hand: [8], deck: [1], winners: [2, 3, 4, 5, 6] }), // Jungle p6
        mkPlayer('b', { hand: [13], deck: [1] }), // Boy power 1
      ],
      attackerIndex: 0,
      phase: 'commit',
      battle: {
        declaredStat: 'power',
        attackerId: 'a',
        abilityCursor: 'a',
        nullifiedGroups: [],
        nullifiedPlayers: [],
        forcedWinnerId: null,
        grandBattle: false,
        log: [],
      },
      vakharcDepth: 0,
      forcedNextVakharc: null,
      seed: 1,
      winnerId: null,
      version: 0,
    };
    let s = expectOk(applyMove(g, { type: 'commitCard', cardId: 8 }, 'a'));
    s = expectOk(applyMove(s, { type: 'commitCard', cardId: 13 }, 'b'));
    s = skipAbilities(s);
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('a');
    expect(groupVictoryCount(s.players[0])).toBe(6);
  });
});
