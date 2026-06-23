import { getCard, GROUPS } from '../data/cards';
import { GROUP_VICTORY_TARGET } from '../engine/winCondition';
import type { GroupSlug } from '../types/card';

/** Winner pile with a distinct-group victory tally (target 6). */
export function WinPile({ cardIds }: { cardIds: number[] }) {
  const groups = new Set<GroupSlug>();
  for (const id of cardIds) {
    const g = getCard(id).group;
    if (g) groups.add(g);
  }

  return (
    <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-emerald-300">Winners</span>
        <span className="text-xs text-emerald-200">
          {groups.size}/{GROUP_VICTORY_TARGET} groups · {cardIds.length} cards
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {[...groups].map((g) => (
          <span
            key={g}
            className="rounded bg-emerald-800/70 px-1.5 py-0.5 text-[10px] text-emerald-100"
          >
            {GROUPS[g].name}
          </span>
        ))}
        {groups.size === 0 && <span className="text-[10px] text-emerald-500/60">—</span>}
      </div>
    </div>
  );
}

/** Loser pile — just a visible count. */
export function LoserPile({ cardIds }: { cardIds: number[] }) {
  return (
    <div className="rounded-lg border border-rose-900 bg-rose-950/40 p-2">
      <span className="text-xs font-semibold text-rose-300">Losers</span>
      <span className="ml-2 text-xs text-rose-200">{cardIds.length} cards</span>
    </div>
  );
}
