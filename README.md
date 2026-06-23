# Master Crok

Real-time multiplayer web implementation of the Hungarian trading card game
**Master Crok** (Chio © 2001). N-player, browser-based, powered by Supabase
Realtime. See [`CLAUDE.md`](./CLAUDE.md) for the full design, rules, and card data.

## Stack

React + TypeScript (Vite) · Tailwind · Supabase (Postgres + Realtime + Edge
Functions) · Cloudflare Pages.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:5173
npm test                     # engine unit tests (Vitest)
npm run build                # production build into dist/
```

Without Supabase env vars the app runs in "local-only" mode (engine + UI build;
no auth/persistence).

## Supabase setup

1. Create a Supabase project; copy the project URL and anon key into
   `.env.local`.
2. Run the SQL migrations in `supabase/migrations/` (CLI `supabase db push`, or
   paste into the SQL editor in order: profiles → matches → RLS).
3. Deploy the move validator:
   ```bash
   supabase functions deploy play-move
   ```
   It re-runs the shared engine (`src/engine`) under the service role, so the
   relative imports and `cards.json` are bundled automatically.
4. Auth: username/password (emails are synthesized as `username@crok.local`;
   email confirmation is disabled — see `supabase/config.toml`).

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA routing is handled by `public/_redirects` (emitted to `dist/`).

## Project layout

- `src/engine/` — pure, deterministic game engine (no React/Supabase). The same
  `applyMove` runs on the client (optimistic) and in the `play-move` Edge
  Function (authority).
- `src/data/cards.json` — the canonical 21-card database; images in
  `public/cards/`.
- `src/components/`, `src/pages/`, `src/hooks/` — UI, routing, realtime.
