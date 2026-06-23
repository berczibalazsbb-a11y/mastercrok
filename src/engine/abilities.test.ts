import { describe, it, expect } from 'vitest';
import { applyMove } from './state';
import { canUseAbility } from './abilities';
import { zeroMods } from '../types/game';
import type { GameState, PlayerState, BattleState } from '../types/game';
import type { StatKey } from '../types/card';

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
    battleMods: zeroMods(),
    abilityUsed: false,
    abilityReserved: false,
    ...over,
  };
}

/** Build an ability-phase state with both players' cards already committed. */
function abilityPhase(
  players: PlayerState[],
  declaredStat: StatKey,
  attackerId: string,
): GameState {
  const battle: BattleState = {
    declaredStat,
    attackerId,
    abilityCursor: attackerId,
    nullifiedGroups: [],
    nullifiedPlayers: [],
    forcedWinnerId: null,
    grandBattle: false,
    log: [],
  };
  return {
    matchId: 'ab',
    players,
    attackerIndex: players.findIndex((p) => p.userId === attackerId),
    phase: 'ability',
    battle,
    vakharcDepth: 0,
    forcedNextVakharc: null,
    seed: 1,
    winnerId: null,
    version: 0,
  };
}

function ok(r: ReturnType<typeof applyMove>): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('Bond — change-stat-free', () => {
  it('changes the declared stat and resolution follows', () => {
    // a: Bond (5/6/7), b: Sumo (8/5/1). Declared power → b wins (8>5).
    // Bond switches to reflex → a wins (7>1).
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 2 }),
        mkPlayer('b', { committed: 10 }),
      ],
      'power',
      'a',
    );
    let s = ok(applyMove(g, { type: 'useAbility', payload: { stat: 'reflex' } }, 'a'));
    // a used ability; b (Sumo) cannot use (int 5 not > Bond int 6) → auto skip → resolve.
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('a');
  });
});

describe('Sheriff — winning-override-on-tie', () => {
  it('wins a tied battle', () => {
    // Both power 3: Sheriff (#21, 3/3/5) vs Indian (#17, 3/5/3). Tie on power.
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 21 }),
        mkPlayer('b', { committed: 17 }),
      ],
      'power',
      'a',
    );
    expect(canUseAbility(g, 'a')).toBe(true);
    let s = ok(applyMove(g, { type: 'useAbility' }, 'a'));
    s = s.phase === 'ability' ? ok(applyMove(s, { type: 'skipAbility' }, s.battle!.abilityCursor)) : s;
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('a');
  });
});

describe('Police — winning-override-copy', () => {
  it('wins by discarding a copy of the opponent card', () => {
    // a: Police (#19) holding a copy of b's committed Bond (#2) in hand.
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 19, hand: [2] }),
        mkPlayer('b', { committed: 2 }),
      ],
      'power',
      'a',
    );
    expect(canUseAbility(g, 'a')).toBe(true);
    let s = ok(applyMove(g, { type: 'useAbility' }, 'a'));
    // The loop still offers the opponent a turn; skip it.
    while (s.phase === 'ability') {
      s = ok(applyMove(s, { type: 'skipAbility' }, s.battle!.abilityCursor));
    }
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('a');
    // The copy was discarded to the loser pile.
    expect(s.players[0].losers).toContain(2);
  });

  it('cannot be used without a matching copy', () => {
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 19, hand: [5] }),
        mkPlayer('b', { committed: 2 }),
      ],
      'power',
      'a',
    );
    expect(canUseAbility(g, 'a')).toBe(false);
  });
});

describe('Samurai — immediate-nullify-all', () => {
  it('nullifies opponents so they cannot use abilities', () => {
    // a: Samurai (#4) attacker; b: Bond (#2). On reveal, Bond is nullified.
    // Build at commit phase and let the second commit trigger reveal+immediates.
    const g: GameState = {
      matchId: 's',
      players: [
        mkPlayer('a', { committed: 4 }),
        mkPlayer('b', { hand: [2], deck: [3] }),
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
    const s = ok(applyMove(g, { type: 'commitCard', cardId: 2 }, 'b'));
    // Samurai (6 power) beats Bond (5). b is nullified → no ability → resolved.
    expect(s.phase).toBe('finished');
    expect(s.winnerId).toBe('a');
  });
});

describe('Sumo — conditional-power-boost', () => {
  it('gains +2 power only when its intelligence beats all opponents', () => {
    // a: Sumo (8/5/1). b: Boy (1/4/6) int 4 < 5 → usable, +2 → power 10.
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 10 }),
        mkPlayer('b', { committed: 13 }),
      ],
      'power',
      'a',
    );
    expect(canUseAbility(g, 'a')).toBe(true);
    let s = ok(applyMove(g, { type: 'useAbility' }, 'a'));
    expect(s.players[0].battleMods.power).toBe(2);
    if (s.phase === 'ability') {
      s = ok(applyMove(s, { type: 'skipAbility' }, s.battle!.abilityCursor));
    }
    expect(s.winnerId).toBe('a');
  });
});

describe('reserve (tartalékolás)', () => {
  it('costs a winning Crok and grants another pass', () => {
    const g = abilityPhase(
      [
        mkPlayer('a', { committed: 2, winners: [3] }), // Bond, has a winner to pay
        mkPlayer('b', { committed: 10 }),
      ],
      'power',
      'a',
    );
    const s = ok(applyMove(g, { type: 'reserveAbility' }, 'a'));
    // Winner moved to losers as the reserve cost.
    expect(s.players[0].winners).toHaveLength(0);
    expect(s.players[0].losers).toContain(3);
  });
});
