import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMatch } from '../hooks/useMatch';
import { GameBoard } from '../components/GameBoard';
import { startMatch } from '../lib/matches';

export default function Match() {
  const { id } = useParams<{ id: string }>();
  const { userId, loading: authLoading } = useAuth();
  const m = useMatch(id ?? null, userId);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  if (authLoading || m.loading) return <Centered>Loading…</Centered>;
  if (!userId) return <Centered>Please <Link className="text-amber-400" to="/">sign in</Link>.</Centered>;
  if (!m.meta) return <Centered>Match not found.</Centered>;

  // Waiting room.
  if (m.meta.status === 'waiting' || !m.state) {
    const isHost = m.meta.hostId === userId;
    const link = `${location.origin}/join/${m.meta.inviteCode}`;
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-amber-400">Waiting room</h1>
        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-sm text-slate-300">Invite code</p>
          <p className="text-2xl font-black tracking-widest text-amber-300">
            {m.meta.inviteCode}
          </p>
          <p className="mt-1 break-all text-xs text-slate-400">{link}</p>
        </div>
        <div>
          <p className="text-sm text-slate-300">Players ({m.meta.players.length})</p>
          <ul className="list-inside list-disc text-slate-200">
            {m.meta.players.map((p) => (
              <li key={p}>{p.slice(0, 8)}{p === m.meta!.hostId && ' (host)'}</li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button
            disabled={busy || m.meta.players.length < 2}
            onClick={async () => {
              setBusy(true);
              setStartError(null);
              try {
                await startMatch(id!, m.meta!.players);
              } catch (e) {
                setStartError(e instanceof Error ? e.message : 'Failed to start.');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-amber-600 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50"
          >
            {m.meta.players.length < 2 ? 'Need 2+ players' : 'Start game'}
          </button>
        ) : (
          <p className="text-slate-400">Waiting for the host to start…</p>
        )}
        {startError && <p className="text-sm text-rose-400">{startError}</p>}
        <Link to="/" className="text-center text-sm text-slate-400 hover:text-slate-200">
          ← Back to lobby
        </Link>
      </div>
    );
  }

  // Active / finished game.
  return (
    <div>
      <div className="flex items-center justify-between p-2">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">← Lobby</Link>
        {m.state.phase === 'finished' && (
          <span className="font-bold text-amber-300">
            {m.state.winnerId === userId ? 'You win! 🏆' : 'Game over'}
          </span>
        )}
      </div>
      <GameBoard
        state={m.state}
        userId={userId}
        error={m.error}
        actions={{
          declareStat: m.declareStat,
          commitCard: m.commitCard,
          commitVakharc: m.commitVakharc,
          useAbility: m.useAbility,
          reserveAbility: m.reserveAbility,
          skipAbility: m.skipAbility,
        }}
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-24 text-center text-slate-300">{children}</div>
  );
}
