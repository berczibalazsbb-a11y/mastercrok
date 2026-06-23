import raw from './cards.json';
import type {
  CardDatabase,
  CrokCard,
  GroupSlug,
  StatKey,
  AbilityArchetype,
} from '../types/card';

const db = raw as unknown as CardDatabase;

export const CARD_DB: CardDatabase = db;
export const CARDS: CrokCard[] = db.cards;
export const GROUPS = db.groups;

export const cardById = new Map<number, CrokCard>(
  CARDS.map((c) => [c.id, c]),
);
export const cardBySlug = new Map<string, CrokCard>(
  CARDS.map((c) => [c.slug, c]),
);

export function getCard(id: number): CrokCard {
  const card = cardById.get(id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

const VALID_STATS: StatKey[] = ['power', 'intelligence', 'reflex'];
const VALID_GROUPS = new Set(Object.keys(db.groups));
const VALID_ARCHETYPES = new Set<AbilityArchetype>(
  Object.keys(db.abilityArchetypes) as AbilityArchetype[],
);

/**
 * Validate the card database shape. Called once at module load (dev) and
 * available to tests. Throws on the first structural problem.
 */
export function validateCardDatabase(database: CardDatabase = db): void {
  const ids = new Set<number>();
  if (database.cards.length !== database.meta.totalCards) {
    throw new Error(
      `meta.totalCards (${database.meta.totalCards}) != cards.length (${database.cards.length})`,
    );
  }
  for (const c of database.cards) {
    if (ids.has(c.id)) throw new Error(`Duplicate card id: ${c.id}`);
    ids.add(c.id);

    if (c.group !== null && !VALID_GROUPS.has(c.group)) {
      throw new Error(`Card ${c.id} (${c.name}) has unknown group: ${c.group}`);
    }
    for (const s of VALID_STATS) {
      if (typeof c.stats[s] !== 'number') {
        throw new Error(`Card ${c.id} missing stat: ${s}`);
      }
    }
    if (!VALID_ARCHETYPES.has(c.ability.archetype)) {
      throw new Error(
        `Card ${c.id} has unknown ability archetype: ${c.ability.archetype}`,
      );
    }
  }
}

export function groupVictoryGroups(cardIds: number[]): GroupSlug[] {
  const groups = new Set<GroupSlug>();
  for (const id of cardIds) {
    const g = getCard(id).group;
    if (g) groups.add(g);
  }
  return [...groups];
}

// Fail fast in development if the data is malformed.
if (import.meta.env?.DEV) {
  validateCardDatabase();
}
