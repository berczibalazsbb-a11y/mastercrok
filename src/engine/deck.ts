import { getCard } from '../data/cards';

export interface DeckValidation {
  valid: boolean;
  errors: string[];
}

export const MIN_DECK_SIZE = 10;

/** Max copies of a single named card allowed at a given deck size. */
export function copyLimit(deckSize: number): number {
  return Math.floor(deckSize / 10);
}

/**
 * Validate a deck (array of card ids) against the official rules:
 * - minimum 10 cards
 * - at most `floor(size / 10)` copies of any single named card
 */
export function validateDeck(cardIds: number[]): DeckValidation {
  const errors: string[] = [];

  if (cardIds.length < MIN_DECK_SIZE) {
    errors.push(`Deck must have at least ${MIN_DECK_SIZE} cards (has ${cardIds.length}).`);
  }

  // All ids must reference real cards.
  for (const id of cardIds) {
    try {
      getCard(id);
    } catch {
      errors.push(`Unknown card id in deck: ${id}`);
    }
  }

  const limit = copyLimit(cardIds.length);
  const counts = new Map<number, number>();
  for (const id of cardIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > limit) {
      let name = String(id);
      try {
        name = getCard(id).name;
      } catch {
        /* already reported above */
      }
      errors.push(
        `Too many copies of "${name}": ${count} (limit ${limit} at deck size ${cardIds.length}).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
