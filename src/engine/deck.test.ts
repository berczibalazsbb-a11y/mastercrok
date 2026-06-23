import { describe, it, expect } from 'vitest';
import { validateDeck, copyLimit } from './deck';

describe('deck rules', () => {
  it('computes copy limit as floor(size/10)', () => {
    expect(copyLimit(10)).toBe(1);
    expect(copyLimit(19)).toBe(1);
    expect(copyLimit(20)).toBe(2);
    expect(copyLimit(30)).toBe(3);
  });

  it('rejects decks below the minimum size', () => {
    const deck = Array.from({ length: 9 }, (_, i) => (i % 21) + 1);
    const res = validateDeck(deck);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('at least'))).toBe(true);
  });

  it('accepts a legal 10-card singleton deck', () => {
    const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(validateDeck(deck).valid).toBe(true);
  });

  it('enforces the per-card copy limit', () => {
    // 10 cards, two copies of card 2 → over the limit of 1.
    const deck = [2, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const res = validateDeck(deck);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Too many copies'))).toBe(true);
  });

  it('allows two copies at deck size 20', () => {
    const deck = [
      2, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ];
    expect(validateDeck(deck).valid).toBe(true);
  });

  it('flags unknown card ids', () => {
    const deck = [999, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(validateDeck(deck).valid).toBe(false);
  });
});
