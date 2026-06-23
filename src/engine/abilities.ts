import { getCard } from '../data/cards';
import type { GameState, PlayerState, AbilityPayload } from '../types/game';
import type { StatKey, AbilityArchetype, CrokCard } from '../types/card';

/**
 * Ability engine. Each card maps (via cards.json) to an `AbilityArchetype`;
 * this module implements one behaviour per archetype behind the four seam
 * functions consumed by the state reducer:
 *   - canUseAbility / applyAbility  → the clockwise ability loop
 *   - applyImmediateAbilities       → `Azonnal…` effects at reveal
 *   - effectiveValue                → stat modifiers at resolution
 *
 * Some abilities that require a sub-decision by another player (Executor) or a
 * recursive borrow (Devil) use documented MVP simplifications.
 */

type Kind = 'loop' | 'immediate' | 'afterBattle';

const KIND: Record<AbilityArchetype, Kind> = {
  'swap-from-hand': 'loop',
  'swap-from-deck-blind': 'loop',
  'force-opponent-deck-swap': 'loop',
  'change-stat-free': 'loop',
  'change-stat-to-power': 'loop',
  'immediate-nullify-all': 'immediate',
  'immediate-nullify-group-or-draw': 'immediate',
  'copy-ability': 'loop',
  'recover-loser-to-hand': 'loop',
  'force-extra-battle': 'loop',
  'force-opponent-discard': 'loop',
  'buff-next-battle': 'loop',
  'conditional-power-boost': 'loop',
  'trigger-vakharc-on-loss': 'afterBattle',
  'scale-with-opponents': 'loop',
  'attacker-plus-reflex': 'loop',
  'deficit-buff': 'loop',
  'sacrifice-power': 'loop',
  'deck-scry': 'loop',
  'winning-override-copy': 'loop',
  'winning-override-on-tie': 'loop',
};

// --- small helpers ----------------------------------------------------------

function player(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.userId === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

function committedCard(p: PlayerState): CrokCard | null {
  return p.committed != null ? getCard(p.committed) : null;
}

function opponents(state: GameState, id: string): PlayerState[] {
  return state.players.filter((p) => p.userId !== id && p.committed != null);
}

function isNullified(state: GameState, p: PlayerState, card: CrokCard): boolean {
  const b = state.battle!;
  if (b.nullifiedPlayers.includes(p.userId)) return true;
  if (card.group && b.nullifiedGroups.includes(card.group)) return true;
  return false;
}

/** Value map (base stat + battle mods) in the declared stat, committed only. */
function currentValues(state: GameState): Record<string, number> {
  const stat = state.battle!.declaredStat;
  const out: Record<string, number> = {};
  for (const p of state.players) {
    const card = committedCard(p);
    if (!card) continue;
    let v = card.stats[stat] + p.battleMods[stat];
    if (p.extraCommitted != null) v += getCard(p.extraCommitted).stats[stat];
    out[p.userId] = v;
  }
  return out;
}

function topIsTie(values: Record<string, number>): boolean {
  const vals = Object.values(values);
  if (vals.length < 2) return false;
  const max = Math.max(...vals);
  return vals.filter((v) => v === max).length > 1;
}

// --- usability (loop abilities) ---------------------------------------------

function loopUsable(state: GameState, p: PlayerState, card: CrokCard): boolean {
  const arch = card.ability.archetype;
  switch (arch) {
    case 'swap-from-hand':
      return p.hand.some((id) => id !== 1); // any non-Master card
    case 'swap-from-deck-blind':
    case 'deck-scry':
      return p.deck.length > 0;
    case 'force-opponent-deck-swap':
      return opponents(state, p.userId).some((o) => o.deck.length > 0);
    case 'change-stat-to-power':
      return state.battle!.declaredStat !== 'power';
    case 'recover-loser-to-hand':
      return p.losers.length > 0;
    case 'force-opponent-discard':
      return opponents(state, p.userId).some((o) => o.hand.length > 0);
    case 'conditional-power-boost': {
      const myInt = card.stats.intelligence;
      return opponents(state, p.userId).every(
        (o) => getCard(o.committed!).stats.intelligence < myInt,
      );
    }
    case 'sacrifice-power':
      return p.hand.length > 0;
    case 'winning-override-copy': {
      const names = new Set(opponents(state, p.userId).map((o) => getCard(o.committed!).name));
      return p.hand.some((id) => names.has(getCard(id).name));
    }
    case 'winning-override-on-tie':
      return topIsTie(currentValues(state));
    case 'copy-ability':
      return state.players.some(
        (o) =>
          o.userId !== p.userId &&
          o.losers.some((id) => {
            const a = getCard(id).ability.archetype;
            return KIND[a] === 'loop' && a !== 'copy-ability';
          }),
      );
    // Always-usable (effect may be a no-op): Bond, Captain, Sensei, Army, Boy, Cave.
    case 'change-stat-free':
    case 'force-extra-battle':
    case 'buff-next-battle':
    case 'scale-with-opponents':
    case 'attacker-plus-reflex':
    case 'deficit-buff':
      return true;
    default:
      return false;
  }
}

// --- application ------------------------------------------------------------

function applyLoop(
  state: GameState,
  p: PlayerState,
  card: CrokCard,
  payload: AbilityPayload | undefined,
  archOverride?: AbilityArchetype,
): void {
  const arch = archOverride ?? card.ability.archetype;
  const b = state.battle!;
  const log = (m: string) => b.log.push(m);

  switch (arch) {
    case 'swap-from-hand': {
      const cardId = payload?.cardId;
      if (cardId == null || cardId === 1) throw new Error('Choose a non-Master card from your hand.');
      const idx = p.hand.indexOf(cardId);
      if (idx < 0) throw new Error('That card is not in your hand.');
      p.hand.splice(idx, 1);
      if (p.committed != null) p.hand.push(p.committed);
      p.committed = cardId;
      log(`${p.userId} swaps in ${getCard(cardId).name} (Master).`);
      break;
    }
    case 'swap-from-deck-blind': {
      if (p.deck.length === 0) throw new Error('Your deck is empty.');
      const top = p.deck.shift()!;
      if (p.committed != null) p.hand.push(p.committed);
      p.committed = top;
      log(`${p.userId} blind-swaps for the top of their deck.`);
      break;
    }
    case 'force-opponent-deck-swap': {
      const target = player(state, payload?.targetPlayerId ?? '');
      if (target.deck.length === 0) throw new Error('Target has an empty deck.');
      const bottom = target.deck.pop()!;
      if (target.committed != null) target.hand.push(target.committed);
      target.committed = bottom;
      log(`${p.userId} forces ${target.userId} to swap to their deck bottom.`);
      break;
    }
    case 'change-stat-free': {
      if (!payload?.stat) throw new Error('Choose a stat.');
      b.declaredStat = payload.stat;
      log(`${p.userId} changes the stat to ${payload.stat}.`);
      break;
    }
    case 'change-stat-to-power': {
      b.declaredStat = 'power';
      log(`${p.userId} changes the stat to power.`);
      break;
    }
    case 'recover-loser-to-hand': {
      const cardId = payload?.cardId;
      if (cardId == null) throw new Error('Choose a card from your loser pile.');
      const idx = p.losers.indexOf(cardId);
      if (idx < 0) throw new Error('That card is not in your loser pile.');
      p.losers.splice(idx, 1);
      p.hand.push(cardId);
      log(`${p.userId} recovers ${getCard(cardId).name} to hand.`);
      break;
    }
    case 'force-extra-battle': {
      b.grandBattle = true;
      for (const q of state.players) {
        if (q.committed != null && q.deck.length > 0) q.extraCommitted = q.deck.shift()!;
      }
      log(`${p.userId} starts a Grand Battle (summed values).`);
      break;
    }
    case 'force-opponent-discard': {
      const target = player(state, payload?.targetPlayerId ?? '');
      if (target.hand.length === 0) throw new Error('Target has an empty hand.');
      const cardId = payload?.cardId ?? target.hand[0];
      const idx = target.hand.indexOf(cardId);
      if (idx < 0) throw new Error("That card is not in the target's hand.");
      target.hand.splice(idx, 1);
      target.losers.push(cardId);
      log(`${p.userId} forces ${target.userId} to discard ${getCard(cardId).name}.`);
      break;
    }
    case 'buff-next-battle': {
      p.pendingBuffs.senseiAllStats = (p.pendingBuffs.senseiAllStats ?? 0) + 1;
      log(`${p.userId} buffs their next battle (+1 all stats).`);
      break;
    }
    case 'conditional-power-boost': {
      p.battleMods.power += 2;
      log(`${p.userId}'s Sumo gains +2 power.`);
      break;
    }
    case 'scale-with-opponents': {
      const n = opponents(state, p.userId).length;
      p.battleMods.power += n;
      p.battleMods.intelligence += n;
      p.battleMods.reflex += n;
      log(`${p.userId}'s Army gains +${n} to all stats.`);
      break;
    }
    case 'attacker-plus-reflex': {
      p.pendingBuffs.nextRoundAttacker = true;
      if (b.attackerId !== p.userId) p.battleMods.reflex += 2;
      log(`${p.userId} will attack next round (+2 reflex if defending).`);
      break;
    }
    case 'deficit-buff': {
      const target = player(state, payload?.targetPlayerId ?? '');
      const n = Math.max(0, target.winners.length - p.winners.length);
      p.battleMods.power += n;
      p.battleMods.intelligence += n;
      p.battleMods.reflex += n;
      log(`${p.userId}'s Cave gains +${n} to all stats.`);
      break;
    }
    case 'sacrifice-power': {
      const cardId = payload?.cardId;
      if (cardId == null) throw new Error('Choose a card to sacrifice.');
      const idx = p.hand.indexOf(cardId);
      if (idx < 0) throw new Error('That card is not in your hand.');
      p.hand.splice(idx, 1);
      p.losers.push(cardId);
      const replacement = getCard(cardId).stats.power;
      p.battleMods.power += replacement - card.stats.power;
      log(`${p.userId} sacrifices for ${replacement} power.`);
      break;
    }
    case 'deck-scry': {
      const count = Math.min(6, p.deck.length);
      const order = payload?.order;
      if (order && order.length === count) {
        const top = order.slice();
        const valid =
          top.every((id) => p.deck.slice(0, count).includes(id)) &&
          new Set(top).size === count;
        if (!valid) throw new Error('Invalid scry order.');
        p.deck = [...top, ...p.deck.slice(count)];
      }
      log(`${p.userId} scouts the top ${count} cards.`);
      break;
    }
    case 'winning-override-copy': {
      const names = new Set(opponents(state, p.userId).map((o) => getCard(o.committed!).name));
      const matchId = p.hand.find((id) => names.has(getCard(id).name));
      if (matchId == null) throw new Error('No matching copy in hand.');
      const idx = p.hand.indexOf(matchId);
      p.hand.splice(idx, 1);
      p.losers.push(matchId);
      b.forcedWinnerId = p.userId;
      log(`${p.userId}'s Police arrests the battle (auto-win).`);
      break;
    }
    case 'winning-override-on-tie': {
      if (!topIsTie(currentValues(state))) throw new Error('No tie to exploit.');
      b.forcedWinnerId = p.userId;
      log(`${p.userId}'s Sheriff wins the duel on the tie.`);
      break;
    }
    case 'copy-ability': {
      const target = player(state, payload?.targetPlayerId ?? '');
      const cardId = payload?.cardId;
      if (cardId == null || !target.losers.includes(cardId))
        throw new Error("Choose a card from another player's loser pile.");
      const borrowed = getCard(cardId);
      const borrowedArch = borrowed.ability.archetype;
      if (KIND[borrowedArch] !== 'loop' || borrowedArch === 'copy-ability')
        throw new Error('That ability cannot be borrowed.');
      log(`${p.userId}'s Devil borrows ${borrowed.name}'s ability.`);
      applyLoop(state, p, card, payload, borrowedArch);
      break;
    }
    default:
      throw new Error(`Ability ${arch} cannot be used now.`);
  }
}

// --- seam (consumed by state.ts) --------------------------------------------

export function canUseAbility(state: GameState, playerId: string): boolean {
  if (!state.battle) return false;
  const p = player(state, playerId);
  const card = committedCard(p);
  if (!card || p.abilityUsed) return false;
  if (KIND[card.ability.archetype] !== 'loop') return false;
  if (isNullified(state, p, card)) return false;
  return loopUsable(state, p, card);
}

export function applyImmediateAbilities(state: GameState): GameState {
  const b = state.battle;
  if (!b) return state;
  const n = state.players.length;
  for (let i = 0; i < n; i++) {
    const p = state.players[(state.attackerIndex + i) % n];
    const card = committedCard(p);
    if (!card || KIND[card.ability.archetype] !== 'immediate') continue;
    if (isNullified(state, p, card)) continue;

    if (card.ability.archetype === 'immediate-nullify-all') {
      for (const o of state.players) {
        if (o.userId !== p.userId && o.committed != null && !b.nullifiedPlayers.includes(o.userId)) {
          b.nullifiedPlayers.push(o.userId);
        }
      }
      b.log.push(`${p.userId}'s Samurai nullifies opponents' abilities.`);
    } else if (card.ability.archetype === 'immediate-nullify-group-or-draw') {
      const devilInPlay = state.players.some(
        (o) => o.committed != null && getCard(o.committed).group === 'devil',
      );
      if (devilInPlay) {
        if (!b.nullifiedGroups.includes('devil')) b.nullifiedGroups.push('devil');
        b.log.push(`${p.userId}'s Priest nullifies devil-group abilities.`);
      } else if (p.deck.length > 0) {
        p.hand.push(p.deck.shift()!);
        b.log.push(`${p.userId}'s Priest draws a card.`);
      }
    }
  }
  return state;
}

export function applyAbility(
  state: GameState,
  playerId: string,
  payload?: AbilityPayload,
): GameState {
  const p = player(state, playerId);
  const card = committedCard(p);
  if (!card) throw new Error('You have no committed card.');
  if (!canUseAbility(state, playerId)) throw new Error('No usable ability.');
  applyLoop(state, p, card, payload);
  return state;
}

export function effectiveValue(
  base: number,
  state: GameState,
  playerId: string,
  stat: StatKey,
): number {
  const p = player(state, playerId);
  return base + p.battleMods[stat];
}
