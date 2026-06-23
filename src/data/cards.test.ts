import { describe, it, expect } from 'vitest';
import { CARDS, validateCardDatabase, getCard, groupVictoryGroups } from './cards';

describe('card database', () => {
  it('loads all 21 cards and validates', () => {
    expect(CARDS).toHaveLength(21);
    expect(() => validateCardDatabase()).not.toThrow();
  });

  it('has unique ids 1..21', () => {
    const ids = CARDS.map((c) => c.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });

  it('treats Master Crok as groupless', () => {
    expect(getCard(1).group).toBeNull();
  });

  it('counts distinct groups, ignoring null and duplicates', () => {
    // Master (null) + two spies (Bond #2, Police #19) + Devil (#3)
    expect(groupVictoryGroups([1, 2, 19, 3]).sort()).toEqual(['devil', 'spy']);
  });
});
