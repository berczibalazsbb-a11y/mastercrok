import { getCard } from '../data/cards';
import { GROUPS } from '../data/cards';
import { StatBadge } from './StatBadge';
import { STAT_KEYS } from '../types/card';
import type { StatKey } from '../types/card';

export function CrokCard({
  cardId,
  faceDown = false,
  selected = false,
  declaredStat,
  mods,
  onClick,
  size = 'md',
}: {
  cardId?: number;
  faceDown?: boolean;
  selected?: boolean;
  declaredStat?: StatKey;
  /** Per-battle stat deltas to surface on the badges. */
  mods?: Record<StatKey, number>;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const width = size === 'sm' ? 'w-24' : size === 'lg' ? 'w-56' : 'w-40';

  if (faceDown || cardId == null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${width} aspect-[7/11] rounded-xl border-2 border-amber-700 bg-gradient-to-br from-red-900 to-slate-900 shadow-lg ${
          onClick ? 'hover:brightness-110' : ''
        }`}
        aria-label="Face-down Crok"
      >
        <div className="flex h-full items-center justify-center text-3xl font-black text-amber-500/60">
          ?
        </div>
      </button>
    );
  }

  const card = getCard(cardId);
  const group = card.group ? GROUPS[card.group] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        width,
        'group relative overflow-hidden rounded-xl border-2 text-left shadow-lg transition',
        selected ? 'border-amber-300 -translate-y-2' : 'border-slate-700',
        onClick ? 'hover:-translate-y-1 hover:brightness-110' : '',
      ].join(' ')}
    >
      <img
        src={card.image}
        alt={card.name}
        className="aspect-[7/11] w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-2 py-1">
        <span className="truncate text-xs font-bold text-amber-300">{card.name}</span>
        {group && (
          <span className="rounded bg-black/50 px-1 text-[10px] text-slate-200" title={group.name}>
            {group.name}
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/85 to-transparent px-1 pb-1 pt-3">
        {STAT_KEYS.map((s) => (
          <StatBadge
            key={s}
            stat={s}
            value={card.stats[s]}
            active={declaredStat === s}
            delta={mods?.[s] ?? 0}
          />
        ))}
      </div>
    </button>
  );
}
