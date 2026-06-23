import { supabase } from './supabaseClient';

/**
 * Username/password auth. Supabase Auth is email-based, so we map a username to
 * a synthetic email. Email confirmations are disabled (see config.toml) so a
 * fresh sign-up can play immediately.
 */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@crok.local`;
}

export async function signUp(username: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured.');
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
  const user = data.user;
  if (user) {
    const { error: pErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username: username.trim() }, { onConflict: 'id' });
    if (pErr) throw pErr;
  }
}

export async function signIn(username: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured.');
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
