import { useState } from 'react';
import { getCard } from '../data/cards';
import { CrokCard } from './CrokCard';
import { canUseAbility } from '../engine/abilities';
import { STAT_OPTIONS } from '../engine/selectors';
import type { GameState, PlayerState, AbilityPayload } from '../types/game';
import type { StatKey } from '../types/card';

interface Actions {
  declareStat: (s: StatKey) => void;
  useAbility: (p?: AbilityPayload) => void;
  reserveAbility: () => void;
  skipAbility: () => void;
  chooseDiscard: (cardId: number) => void;
}

/** Archetypes that resolve with no extra input — a single "Use ability" button. */
const PLAIN_USE = new Set([
  'change-stat-to-power',
  'swap-from-deck-blind',
  'force-extra-battle',
  'buff-next-battle',
  'conditional-power-boost',
  'scale-with-opponents',
  'attacker-plus-reflex',
  'deck-scry',
  'winning-override-copy',
  'winning-override-on-tie',
]);

/** Archetypes whose card is chosen from the player's own hand (in GameBoard). */
const HAND_PICK = new Set(['swap-from-hand', 'sacrifice-power']);

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
  const revealed =
    state.phase === 'ability' || state.phase === 'resolve' || state.phase === 'finished';
  const me = state.players.find((p) => p.userId === userId);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="text-sm text-slate-300">
        Battle stat:{' '}
        <span className="font-bold uppercase text-amber-300">{battle?.declaredStat ?? '—'}</span>
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

      {/* Victim discard prompt (Executor ability) */}
      {state.phase === 'ability' &&
        battle?.pendingVictimDiscard?.targetPlayerId === userId &&
        me && (
          <VictimDiscardPanel hand={me.hand} onChoose={actions.chooseDiscard} />
        )}

      {/* Ability-phase controls */}
      {state.phase === 'ability' &&
        !battle?.pendingVictimDiscard &&
        battle?.abilityCursor === userId &&
        me && (
          <AbilityPanel state={state} userId={userId} actions={actions} />
        )}
    </div>
  );
}

/** A row of selectable small cards. */
function CardRow({
  cardIds,
  onPick,
}: {
  cardIds: number[];
  onPick: (cardId: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {cardIds.map((id, i) => (
        <CrokCard key={`${id}-${i}`} cardId={id} size="sm" onClick={() => onPick(id)} />
      ))}
      {cardIds.length === 0 && <span className="text-xs text-slate-500">no cards</span>}
    </div>
  );
}

function TargetButtons({
  players,
  onPick,
}: {
  players: PlayerState[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {players.map((o) => (
        <button
          key={o.userId}
          onClick={() => onPick(o.userId)}
          className="rounded bg-purple-600 px-3 py-1 text-sm hover:bg-purple-500"
        >
          {o.userId.slice(0, 6)}
        </button>
      ))}
    </div>
  );
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
  const [target, setTarget] = useState<string | null>(null);

  const me = state.players.find((p) => p.userId === userId)!;
  const card = me.committed != null ? getCard(me.committed) : null;
  const usable = canUseAbility(state, userId);
  const arch = card?.ability.archetype;
  const opponents = state.players.filter((p) => p.userId !== userId && p.committed != null);

  // Players whose loser pile has a borrowable ability (for Devil).
  const borrowSources = state.players.filter(
    (p) =>
      p.userId !== userId &&
      p.losers.some((id) => getCard(id).ability.archetype !== 'copy-ability'),
  );
  const targetPlayer = target ? state.players.find((p) => p.userId === target) ?? null : null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-800/70 p-3">
      {card && (
        <p className="max-w-md text-center text-xs text-slate-300">
          <span className="font-semibold text-amber-300">{card.ability.name}:</span>{' '}
          {card.ability.textEn}
        </p>
      )}

      {/* Bond — choose a stat */}
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

      {/* Funny / Cave — pick a target opponent (no card choice) */}
      {usable && (arch === 'force-opponent-deck-swap' || arch === 'deficit-buff') && (
        <TargetButtons
          players={opponents}
          onPick={(id) => actions.useAbility({ targetPlayerId: id })}
        />
      )}

      {/* Executor — pick a target; the victim will choose which card to discard */}
      {usable && arch === 'force-opponent-discard' && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-slate-300">Choose a player to target:</span>
          <TargetButtons
            players={opponents.filter((o) => o.hand.length > 0)}
            onPick={(id) => actions.useAbility({ targetPlayerId: id })}
          />
        </div>
      )}

      {/* Devil — pick a player, then which losing Crok's ability to borrow */}
      {usable && arch === 'copy-ability' && (
        <div className="flex flex-col items-center gap-2">
          {!targetPlayer ? (
            <>
              <span className="text-xs text-slate-300">Borrow an ability from:</span>
              <TargetButtons players={borrowSources} onPick={setTarget} />
            </>
          ) : (
            <>
              <span className="text-xs text-slate-300">
                Choose a losing Crok to borrow from {targetPlayer.userId.slice(0, 6)}:
              </span>
              <CardRow
                cardIds={targetPlayer.losers.filter(
                  (id) => getCard(id).ability.archetype !== 'copy-ability',
                )}
                onPick={(cardId) =>
                  actions.useAbility({ targetPlayerId: targetPlayer.userId, cardId })
                }
              />
              <BackLink onClick={() => setTarget(null)} />
            </>
          )}
        </div>
      )}

      {/* Angel — recover a card from your own loser pile */}
      {usable && arch === 'recover-loser-to-hand' && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-slate-300">Recover a Crok to your hand:</span>
          <CardRow cardIds={me.losers} onPick={(cardId) => actions.useAbility({ cardId })} />
        </div>
      )}

      {/* No-input abilities */}
      {usable && arch && PLAIN_USE.has(arch) && (
        <button
          onClick={() => actions.useAbility()}
          className="rounded bg-emerald-600 px-4 py-1 text-sm font-semibold hover:bg-emerald-500"
        >
          Use ability
        </button>
      )}

      {/* Hand-pick abilities (handled by the Hand in GameBoard) */}
      {usable && arch && HAND_PICK.has(arch) && (
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
      {!usable && <p className="text-xs text-slate-400">No usable ability — skip or reserve.</p>}
    </div>
  );
}

function VictimDiscardPanel({
  hand,
  onChoose,
}: {
  hand: number[];
  onChoose: (cardId: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-rose-900/40 p-3">
      <p className="text-sm font-semibold text-rose-300">
        Executor targets you — choose a card to discard:
      </p>
      <CardRow cardIds={hand} onPick={onChoose} />
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs text-slate-400 underline hover:text-slate-200">
      ← back
    </button>
  );
}
