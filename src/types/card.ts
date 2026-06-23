/** The three battle stats. Keys match `stats` in cards.json. */
export type StatKey = 'power' | 'intelligence' | 'reflex';

export const STAT_KEYS: readonly StatKey[] = ['power', 'intelligence', 'reflex'];

export const STAT_LABELS_HU: Record<StatKey, string> = {
  power: 'erő',
  intelligence: 'intelligencia',
  reflex: 'reflex',
};

/** The 10 group slugs. Master Crok is groupless (`null`). */
export type GroupSlug =
  | 'spy'
  | 'devil'
  | 'yin-yang'
  | 'angel'
  | 'pirate'
  | 'jungle'
  | 'sumo'
  | 'lightning'
  | 'flower'
  | 'sheriff';

export interface GroupInfo {
  name: string;
  icon: string;
  confirmed: boolean;
  cardCount: number;
}

/** Stable identifiers for ability behaviour. One handler per archetype. */
export type AbilityArchetype =
  | 'swap-from-hand'
  | 'swap-from-deck-blind'
  | 'force-opponent-deck-swap'
  | 'change-stat-free'
  | 'change-stat-to-power'
  | 'immediate-nullify-all'
  | 'immediate-nullify-group-or-draw'
  | 'copy-ability'
  | 'recover-loser-to-hand'
  | 'force-extra-battle'
  | 'force-opponent-discard'
  | 'buff-next-battle'
  | 'conditional-power-boost'
  | 'trigger-vakharc-on-loss'
  | 'scale-with-opponents'
  | 'attacker-plus-reflex'
  | 'deficit-buff'
  | 'sacrifice-power'
  | 'deck-scry'
  | 'winning-override-copy'
  | 'winning-override-on-tie';

/** Engine phase at which an ability becomes relevant. */
export type AbilityTrigger =
  | 'onBattleStart'
  | 'onReveal'
  | 'onAbilityPhase'
  | 'onResolve'
  | 'onWinningOverride'
  | 'afterBattle';

export interface Ability {
  name: string;
  nameEn: string;
  textHu: string;
  textEn: string;
  archetype: AbilityArchetype;
  trigger: AbilityTrigger;
  optional: boolean;
  notes?: string;
}

export interface CrokCard {
  id: number;
  edition: string;
  slug: string;
  name: string;
  /** `null` for the unique, groupless Master Crok. */
  group: GroupSlug | null;
  groupConfirmed: boolean;
  stats: Record<StatKey, number>;
  ability: Ability;
  image: string;
  imagePresent: boolean;
}

export interface CardDatabase {
  meta: {
    set: string;
    publisher: string;
    year: number;
    totalCards: number;
    knownCards: number;
    statKeys: StatKey[];
    statKeysHu: Record<StatKey, string>;
    notes: string;
  };
  groups: Record<GroupSlug, GroupInfo>;
  abilityArchetypes: Record<AbilityArchetype, string>;
  cards: CrokCard[];
}
