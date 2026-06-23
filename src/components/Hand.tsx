import { CrokCard } from './CrokCard';

/** The local player's hand: face-up, optionally selectable. */
export function Hand({
  cardIds,
  onPick,
  disabled = false,
  selectedId,
}: {
  cardIds: number[];
  onPick?: (cardId: number) => void;
  disabled?: boolean;
  selectedId?: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-2">
      {cardIds.map((id, i) => (
        <CrokCard
          key={`${id}-${i}`}
          cardId={id}
          size="md"
          selected={selectedId === id}
          onClick={disabled || !onPick ? undefined : () => onPick(id)}
        />
      ))}
      {cardIds.length === 0 && (
        <p className="py-8 text-sm text-slate-400">Empty hand</p>
      )}
    </div>
  );
}

/** An opponent's hand: a fanned face-down stack with a count. */
export function OpponentHand({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
          <div
            key={i}
            className="-ml-6 first:ml-0"
            style={{ zIndex: i }}
          >
            <CrokCard faceDown size="sm" />
          </div>
        ))}
      </div>
      <span className="text-xs text-slate-400">{count}</span>
    </div>
  );
}
