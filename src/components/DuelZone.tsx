import { getCard } from '../data/cards';
import { CrokCard } from './CrokCard';
import { canUseAbility } from '../engine/abilities';
import { STAT_OPTIONS } from '../engine/selectors';
import type { GameState, AbilityPayload } from '../types/game';
import type { StatKey } from '../types/card';

interface Actions {
  declareStat: (s: StatKey) => void;
  useAbility: (p?: AbilityPayload) => void;
  reserveAbility: () => void;
  skipAbility: () => void;
}

export function DuelZone({
  state,
  userId,
  actions,
}: {
  state: GameState;
  userId: string;
  actions: Actions;
}) {
  const battle = state.battle;
  const revealed = state.phase === 'ability' || state.phase === 'resolve' || state.phase === 'finished';
  const me = state.players.find((p) => p.userId === userId);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="text-sm text-slate-300">
        Battle stat:{' '}
        <span className="font-bold uppercase text-amber-300">
          {battle?.declaredStat ?? '—'}
        </span>
        {state.vakharcDepth > 0 && (
          <span className="ml-2 rounded bg-purple-800 px-2 py-0.5 text-xs">
            Vakharc ×{state.vakharcDepth}
          </span>
        )}
      </div>

      {/* Committed cards in the arena */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {state.players.map((p) => {
          const mine = p.userId === userId;
          const show = revealed || (mine && p.committed != null);
          return (
            <div key={p.userId} className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-slate-400">{p.userId.slice(0, 8)}</span>
              {p.committed == null ? (
                <div className="grid aspect-[7/11] w-24 place-items-center rounded-xl border border-dashed border-slate-600 text-xs text-slate-500">
                  waiting
                </div>
              ) : (
                <CrokCard
                  cardId={show ? p.committed : undefined}
                  faceDown={!show}
                  size="sm"
                  declaredStat={battle?.declaredStat}
                  mods={p.battleMods}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Declare-phase controls */}
      {state.phase === 'declare' && battle?.attackerId === userId && (
        <div className="flex gap-2">
          <span className="self-center text-sm text-slate-300">Choose stat:</span>
          {STAT_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => actions.declareStat(s)}
              className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold hover:bg-amber-500"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Ability-phase controls */}
      {state.phase === 'ability' && battle?.abilityCursor === userId && me && (
        <AbilityPanel state={state} userId={userId} actions={actions} />
      )}
    </div>
  );
}

/** Compute a sensible payload for abilities that don't need explicit UI input. */
function autoPayload(state: GameState, userId: string): AbilityPayload | undefined {
  const me = state.players.find((p) => p.userId === userId)!;
  const card = me.committed != null ? getCard(me.committed) : null;
  const arch = card?.ability.archetype;
  if (arch === 'recover-loser-to-hand') return { cardId: me.losers[0] };
  if (arch === 'copy-ability') {
    for (const o of state.players) {
      if (o.userId === userId) continue;
      const id = o.losers.find((cid) => {
        const a = getCard(cid).ability.archetype;
        return a !== 'copy-ability';
      });
      if (id != null) return { targetPlayerId: o.userId, cardId: id };
    }
  }
  return undefined;
}

function AbilityPanel({
  state,
  userId,
  actions,
}: {
  state: GameState;
  userId: string;
  actions: Actions;
}) {
  const me = state.players.find((p) => p.userId === userId)!;
  const card = me.committed != null ? getCard(me.committed) : null;
  const usable = canUseAbility(state, userId);
  const arch = card?.ability.archetype;
  const opponents = state.players.filter((p) => p.userId !== userId && p.committed != null);

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-800/70 p-3">
      {card && (
        <p className="max-w-md text-center text-xs text-slate-300">
          <span className="font-semibold text-amber-300">{card.ability.name}:</span>{' '}
          {card.ability.textEn}
        </p>
      )}

      {/* Bond / change-stat-free: choose a stat */}
      {usable && arch === 'change-stat-free' && (
        <div className="flex gap-2">
          {STAT_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => actions.useAbility({ stat: s })}
              className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-500"
            >
              → {s}
            </button>
          ))}
        </div>
      )}

      {/* Targeted abilities: choose an opponent */}
      {usable &&
        (arch === 'force-opponent-deck-swap' ||
          arch === 'force-opponent-discard' ||
          arch === 'deficit-buff') && (
          <div className="flex gap-2">
            {opponents.map((o) => (
              <button
                key={o.userId}
                onClick={() => actions.useAbility({ targetPlayerId: o.userId })}
                className="rounded bg-purple-600 px-3 py-1 text-sm hover:bg-purple-500"
              >
                target {o.userId.slice(0, 6)}
              </button>
            ))}
          </div>
        )}

      {/* Abilities resolved with an auto-computed payload (or none). */}
      {usable &&
        arch &&
        !['change-stat-free', 'force-opponent-deck-swap', 'force-opponent-discard', 'deficit-buff', 'swap-from-hand', 'sacrifice-power'].includes(
          arch,
        ) && (
          <button
            onClick={() => actions.useAbility(autoPayload(state, userId))}
            className="rounded bg-emerald-600 px-4 py-1 text-sm font-semibold hover:bg-emerald-500"
          >
            Use ability
          </button>
        )}

      {/* Hand-pick abilities: the player selects a card from their hand. */}
      {usable && arch && ['swap-from-hand', 'sacrifice-power'].includes(arch) && (
        <p className="text-xs text-amber-200">Select a card from your hand below.</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={actions.skipAbility}
          className="rounded bg-slate-600 px-4 py-1 text-sm hover:bg-slate-500"
        >
          Skip
        </button>
        <button
          onClick={actions.reserveAbility}
          disabled={me.winners.length === 0}
          className="rounded bg-slate-700 px-4 py-1 text-sm hover:bg-slate-600 disabled:opacity-40"
          title="Costs one winning Crok; act again later"
        >
          Reserve
        </button>
      </div>
      {!usable && (
        <p className="text-xs text-slate-400">No usable ability — skip or reserve.</p>
      )}
    </div>
  );
}
