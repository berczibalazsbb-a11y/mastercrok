import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AuthState {
  userId: string | null;
  username: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  username: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    username: null,
    loading: true,
  });

  useEffect(() => {
    if (!supabase) {
      setState({ userId: null, username: null, loading: false });
      return;
    }

    async function load(userId: string | null) {
      if (!userId) {
        setState({ userId: null, username: null, loading: false });
        return;
      }
      const { data } = await supabase!
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      setState({ userId, username: data?.username ?? null, loading: false });
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
