import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { findByCode, joinMatch } from '../lib/matches';

/** Resolves an invite link: joins the match (if signed in) and redirects. */
export default function Join() {
  const { code } = useParams<{ code: string }>();
  const { userId, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !code) return;
    (async () => {
      try {
        const m = await findByCode(code);
        if (!m) {
          setError('No match with that code.');
          return;
        }
        if (userId) await joinMatch(m.id, userId);
        navigate(`/match/${m.id}`, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to join.');
      }
    })();
  }, [code, userId, loading, navigate]);

  return (
    <div className="mt-24 text-center text-slate-300">
      {error ? (
        <div className="flex flex-col gap-2">
          <p className="text-rose-400">{error}</p>
          <Link to="/" className="text-amber-400">Back to lobby</Link>
        </div>
      ) : !userId && !loading ? (
        <p>
          Please <Link to="/" className="text-amber-400">sign in</Link> to join this match.
        </p>
      ) : (
        <p>Joining…</p>
      )}
    </div>
  );
}
