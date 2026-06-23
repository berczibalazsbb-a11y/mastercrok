import { getCard } from '../data/cards';
import { Hand, OpponentHand } from './Hand';
import { WinPile, LoserPile } from './WinPile';
import { DuelZone } from './DuelZone';
import { phaseHint } from '../engine/selectors';
import type { GameState, AbilityPayload } from '../types/game';
import type { StatKey } from '../types/card';

export interface BoardActions {
  declareStat: (s: StatKey) => void;
  commitCard: (cardId: number) => void;
  commitVakharc: (cardId: number) => void;
  useAbility: (p?: AbilityPayload) => void;
  reserveAbility: () => void;
  skipAbility: () => void;
}

export function GameBoard({
  state,
  userId,
  actions,
  error,
}: {
  state: GameState;
  userId: string;
  actions: BoardActions;
  error?: string | null;
}) {
  const me = state.players.find((p) => p.userId === userId);
  const others = state.players.filter((p) => p.userId !== userId);
  if (!me) return <p className="p-8 text-rose-400">You are not in this match.</p>;

  const isMyAbilityTurn = state.phase === 'ability' && state.battle?.abilityCursor === userId;
  const myCard = me.committed != null ? getCard(me.committed) : null;
  const handPickAbility =
    isMyAbilityTurn &&
    myCard &&
    ['swap-from-hand', 'sacrifice-power'].includes(myCard.ability.archetype);

  function handlePick(cardId: number) {
    if (!me) return;
    if (state.phase === 'commit' && me.committed == null) {
      actions.commitCard(cardId);
    } else if (state.phase === 'vakharc' && me.committed == null) {
      actions.commitVakharc(cardId);
    } else if (handPickAbility) {
      actions.useAbility({ cardId });
    }
  }

  const handActive =
    (state.phase === 'commit' && me.committed == null) ||
    (state.phase === 'vakharc' && me.committed == null) ||
    !!handPickAbility;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      {/* Opponents */}
      <div className="flex flex-wrap justify-center gap-6">
        {others.map((o) => (
          <div key={o.userId} className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              {o.userId.slice(0, 8)}
              {state.players[state.attackerIndex]?.userId === o.userId && ' ⚔️'}
            </span>
            <OpponentHand count={o.hand.length} />
            <WinPile cardIds={o.winners} />
            <LoserPile cardIds={o.losers} />
          </div>
        ))}
      </div>

      {/* Arena */}
      <DuelZone state={state} userId={userId} actions={actions} />

      <p className="text-center text-sm text-slate-400">{phaseHint(state)}</p>
      {error && <p className="text-center text-sm text-rose-400">{error}</p>}

      {/* Me */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          <WinPile cardIds={me.winners} />
          <LoserPile cardIds={me.losers} />
        </div>
        <span className="text-xs font-semibold text-amber-300">
          You {state.players[state.attackerIndex]?.userId === userId && '⚔️ (attacker)'}
        </span>
        <Hand
          cardIds={me.hand}
          onPick={handActive ? handlePick : undefined}
          disabled={!handActive}
        />
        {handPickAbility && (
          <button
            onClick={actions.skipAbility}
            className="mt-1 rounded bg-slate-600 px-4 py-1 text-sm hover:bg-slate-500"
          >
            Skip ability instead
          </button>
        )}
      </div>
    </div>
  );
}
