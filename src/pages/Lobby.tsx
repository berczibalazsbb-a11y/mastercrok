import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signIn, signUp, signOut } from '../lib/auth';
import { createMatch, findByCode, joinMatch } from '../lib/matches';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export default function Lobby() {
  const { userId, username, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <p className="text-rose-300">
          Backend not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </p>
      </Shell>
    );
  }

  if (loading) return <Shell><p className="text-slate-400">Loading…</p></Shell>;
  if (!userId) return <Shell><AuthForm onError={setError} error={error} /></Shell>;

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const m = await createMatch(userId!);
      navigate(`/match/${m.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create match.');
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    setBusy(true);
    setError(null);
    try {
      const m = await findByCode(code);
      if (!m) throw new Error('No match with that code.');
      await joinMatch(m.id, userId!);
      navigate(`/match/${m.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <p className="text-slate-300">
          Signed in as <span className="font-semibold text-amber-300">{username}</span>
        </p>
        <button onClick={() => signOut()} className="text-sm text-slate-400 hover:text-slate-200">
          Sign out
        </button>
      </div>

      <button
        onClick={onCreate}
        disabled={busy}
        className="w-full rounded-lg bg-amber-600 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50"
      >
        Create match
      </button>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          className="flex-1 rounded-lg bg-slate-800 px-3 py-2 uppercase tracking-widest"
        />
        <button
          onClick={onJoin}
          disabled={busy || code.length < 4}
          className="rounded-lg bg-slate-700 px-4 hover:bg-slate-600 disabled:opacity-50"
        >
          Join
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </Shell>
  );
}

function AuthForm({
  onError,
  error,
}: {
  onError: (e: string | null) => void;
  error: string | null;
}) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    onError(null);
    try {
      if (mode === 'up') await signUp(username, password);
      else await signIn(username, password);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="rounded-lg bg-slate-800 px-3 py-2"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="rounded-lg bg-slate-800 px-3 py-2"
      />
      <button
        onClick={submit}
        disabled={busy || !username || password.length < 6}
        className="rounded-lg bg-amber-600 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50"
      >
        {mode === 'in' ? 'Sign in' : 'Sign up'}
      </button>
      <button
        onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 p-6">
      <h1 className="text-center text-4xl font-black text-amber-400">Master Crok</h1>
      {children}
    </div>
  );
}
