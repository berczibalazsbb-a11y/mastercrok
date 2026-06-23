import type { StatKey } from '../types/card';

const COLORS: Record<StatKey, string> = {
  power: 'bg-power',
  intelligence: 'bg-intelligence',
  reflex: 'bg-reflex',
};

const SHORT: Record<StatKey, string> = {
  power: 'P',
  intelligence: 'I',
  reflex: 'R',
};

export function StatBadge({
  stat,
  value,
  active = false,
  delta = 0,
}: {
  stat: StatKey;
  value: number;
  /** Highlight when this is the declared battle stat. */
  active?: boolean;
  /** Ability modifier applied this battle (shown as +N). */
  delta?: number;
}) {
  return (
    <div
      className={[
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold text-white',
        COLORS[stat],
        active ? 'ring-2 ring-amber-300 scale-110' : 'opacity-90',
      ].join(' ')}
      title={stat}
    >
      <span className="opacity-70">{SHORT[stat]}</span>
      <span>{value + delta}</span>
      {delta !== 0 && <span className="text-amber-200">({delta > 0 ? '+' : ''}{delta})</span>}
    </div>
  );
}
