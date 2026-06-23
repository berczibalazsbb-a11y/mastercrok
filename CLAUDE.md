# Master Crok — Project Guide

## What this is

Real-time multiplayer web implementation of the Hungarian trading card game "Master Crok" (Chio © 2001). N-player (min 2), browser-based, powered by Supabase Realtime.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Styling | Tailwind CSS |
| Backend / sync | Supabase (Postgres + Realtime WebSockets) |
| Auth | Supabase Auth — **username/password** |
| Hosting | Cloudflare Pages |
| Edge logic | Supabase Edge Functions (move validation / duel resolution) |

## Repository layout

```
mastercrok/
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── .env.example
├── _redirects                        # Cloudflare Pages SPA fallback
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_profiles.sql
│   │   ├── 0002_matches.sql
│   │   └── 0003_rls_policies.sql
│   └── functions/
│       └── play-move/
│           └── index.ts              # server-authoritative move validator
│
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── lib/
    │   └── supabaseClient.ts
    ├── types/
    │   ├── card.ts                   # CrokCard, StatKey, Group, Ability
    │   └── game.ts                   # PlayerState, GameState, Move, DuelResult
    ├── data/
    │   └── cards.ts                  # full typed card DB (see Card Data section)
    ├── engine/
    │   ├── deck.ts                   # validateDeck()
    │   ├── duel.ts                   # resolveDuel() pure function
    │   ├── abilities.ts              # ability registry + hook system
    │   └── winCondition.ts          # checkWinCondition()
    ├── hooks/
    │   └── useMatch.ts               # Realtime game-engine hook
    ├── components/
    │   ├── CrokCard.tsx
    │   ├── GameBoard.tsx
    │   ├── Hand.tsx
    │   ├── DuelZone.tsx
    │   ├── WinPile.tsx
    │   └── StatBadge.tsx
    └── pages/
        ├── Lobby.tsx
        └── Match.tsx
```

## Official rules summary

### Deck building
- **Minimum 10 Croks**, recommended 40. All decks should be roughly equal size.
- **Copy limit per named card:** `Math.floor(deckSize / 10)` — i.e. ≤1 copy at 10 cards, ≤2 at 20+, ≤3 at 30+.
- The group limit from earlier planning ("max 8 per group") is **incorrect and dropped**.

### Game start
- Each player shuffles their deck face-down and draws **4 cards** to hand.
- Randomly determine the first **attacker**; all others are **defenders**.

### Battle loop (each round)
1. Every player draws **1 card** at the start of each battle.
2. Attacker **declares the stat** (erő / intelligencia / reflex).
3. Attacker places a Crok **face-down**; then defenders do the same, clockwise.
4. All Croks are **revealed simultaneously**.
5. **Ability phase:** starting with the attacker, clockwise, each player may use their Crok's ability (each ability once per battle):
   - `Azonnal…` ("Immediately…") abilities (e.g. Samurai, Priest) fire **instantly, out of turn order**.
   - Conditional abilities can be **used**, **skipped**, or **reserved (tartalékolás)**.
   - **Reserving costs:** move one of your *winning* Croks to your *loser* pile; you get another pass later.
   - Swaps (Master, Jungle) and reactive abilities (Bond, Police) can cause the loop to revisit players.
   - Loop continues until every player has used or permanently declined.
6. **Resolution:** highest value in the declared stat wins (unless a winning-override ability fires, e.g. Police, Sheriff).
7. Winner puts their Crok in their **winner pile** beside the deck; losers put theirs in their **loser pile** on the other side (both visible).
8. **Tie:** all battling Croks go to their owners' loser piles → **Vakharc (blind battle)**: each player places their top deck card (or from hand if deck empty) face-down; last defender from the tied battle becomes new attacker, picks the stat, then reveal resumes.
9. **Vakharc can chain** (recursive ties are handled).

### Win conditions
- **Primary:** first player to collect **6 winning Croks of 6 distinct group icons** wins.
  - Group-victory count = count of distinct group icons in the winner pile (duplicates don't add).
  - The count can **decrease** (reserve cost moves winners to losers).
- **Alternate end:** when any player plays their last Crok, the game ends immediately; player with **most total winners** wins.

### N-player specifics
- Turn order is **clockwise**; ability phase follows the same clockwise order starting from the attacker.
- On tie, the **last defender** (the player just before the full clockwise circle completes) becomes the new attacker.

## Card data

The physical set is **21 cards** (numbered 1/21–21/21, Chio © 2001). All card data has been entered manually from scans (source sites 403 automated fetches). **The complete data set is committed** in `src/data/cards.json` and all 21 images are present in `public/cards/`.

### Known cards (all 21 — source of truth is `src/data/cards.json`)

| # | Name | Group | Power | Int | Reflex | Ability name | Ability text (HU) |
|---|---|---|---|---|---|---|---|
| 1 | Master Crok | **none (unique, groupless)** | 8 | 7 | 9 | Váratlan csapás | Kicserélheted egy másik, a kezedben levő Crokra, ha az nem Master Crok. |
| 2 | Bond Crok | spy (revolver) | 5 | 6 | 7 | Trükkös fordulat | Megváltoztathatod a harc típusát: erő, intelligencia vagy reflex. |
| 3 | Devil Crok | devil (trident) | 6 | 6 | 6 | Lélekrablás | Használhatja egy másik játékos, egyik vesztes Crokjának képességét. |
| 4 | Samurai Crok | yin-yang | 6 | 4 | 8 | Első vágás | Azonnal hatástalanítja az ellenfelek képességeit. (immediate / nullify) |
| 5 | Angel Crok | angel (winged cross) | 3 | 4 | 7 | Feltámasztás | Visszaveheted a kezedbe egy vesztes Crokodat. |
| 6 | Captain Crok | pirate (compass rose) | 5 | 6 | 3 | Nagy ütközet | Everyone adds top-deck card to battle; sum of stat values is used. |
| 7 | Executor Crok | devil (trident) | 7 | 4 | 3 | Nincs kegyelem | Target player moves a hand card to their loser pile. |
| 8 | Jungle Crok | jungle (dagger) | 6 | 3 | 5 | Dzsungelharc | Swap played card for top of own deck, blind. |
| 9 | Sensei Crok | yin-yang | 2 | 9 | 3 | Tanítás ereje | All your Croks +1 all stats in the NEXT battle. |
| 10 | Sumo Crok | sumo (trophy) | 8 | 5 | 1 | Lehengerlés | +2 power if intelligence beats all opponents'. |
| 11 | Pancrator Crok | lightning (bolt) | 9 | 2 | 3 | Tömegverekedés | If this card loses, next battle starts as Vakharc; you pick the stat. |
| 12 | Army Crok | jungle (dagger) | 3 | 4 | 4 | Sorozatlövés | All stats +N where N = opponent count; swapped Croks count extra. |
| 13 | Boy Crok | flower (smiley) | 1 | 4 | 6 | Pimasz csínytevés | Become attacker next round; +2 reflex when defending this battle. |
| 14 | Cave Crok | lightning (bolt) | 7 | 1 | 3 | Dühöngés | All stats +N where N = chosen opponent's wins minus your wins. |
| 15 | Funny Crok | flower (smiley) | 1 | 6 | 4 | Van másik! | Force opponent to swap their card for BOTTOM of their deck. |
| 16 | Gladiator Crok | pirate (compass rose) | 5 | 1 | 5 | Pajzsharc | Change battle type to power (only). |
| 17 | Indian Crok | sheriff (gold star) | 3 | 5 | 3 | Felderítés | Look at top 6 deck cards and reorder them freely. |
| 18 | Karate Crok | sumo (trophy) | 2 | 3 | 6 | Tigriskarom | Discard a hand card to loser pile; use its power stat this battle. |
| 19 | Police Crok | spy (revolver) | 4 | 3 | 4 | Letartóztatás | **Wins battle** if you discard a copy of any played opponent Crok from hand. |
| 20 | Priest Crok | angel (winged cross) | 2 | 7 | 2 | Ima | **Azonnal**: nullify devil-group abilities OR draw 1 card. |
| 21 | Sheriff Crok | sheriff (gold star) | 3 | 3 | 5 | Pisztolypárbaj | **Wins battle** if the current stat result is a tie. |

**10 groups**, each with exactly 2 cards: spy · devil · yin-yang · angel · pirate · jungle · sumo · lightning · flower · sheriff. **Master Crok is unique and groupless** (`group: null`) — it can never contribute toward a group-victory.

### Canonical card data lives in JSON
The source of truth is **`src/data/cards.json`** (validated by `src/data/cards.schema.json`). `src/data/cards.ts` will import and type-narrow this JSON into `CrokCard[]`. To add a card, append an entry to `cards.json` following the schema, then add its image. Group values are slugs keyed into the `groups` map (or `null` for a unique groupless card).

### Card image assets
All 21 images are committed in **`public/cards/`** named `NNN.jpg` (zero-padded card id, e.g. `001.jpg` = Master Crok, `021.jpg` = Sheriff Crok), referenced by each card's `image` field and rendered by `CrokCard.tsx`.

### Resolved ability ambiguities (per owner decision)
- **Captain Crok (`force-extra-battle`):** each player sums their own two cards' value in the declared stat (played card + revealed top-deck card); totals are compared. Players with empty decks contribute only their played card.
- **Karate Crok (`sacrifice-power`):** the sacrificed hand card's power **replaces** Karate's own power (not additive) for this battle.

## Ability system architecture

Abilities are registered in `src/engine/abilities.ts` as handlers keyed by a stable `abilityId`. The engine exposes hooks at these phases:

```
onBattleStart        → before stat declaration
onReveal             → after all Croks are revealed (immediate abilities fire here)
onAbilityPhase       → player's turn in the ability loop (conditional abilities)
onResolve            → before stat comparison (stat-override abilities)
onWinningOverride    → replaces stat comparison entirely (Police, Sheriff)
afterBattle          → cleanup / reserve resolution
```

### Known ability archetypes

| Archetype | Examples | Notes |
|---|---|---|
| `swap-from-hand` | Master | Replace played card with hand card; reopens ability loop |
| `swap-from-deck-blind` | Jungle | Replace played card with top of own deck unseen |
| `force-opponent-deck-swap` | Funny | Force opponent to swap their card for bottom of their deck |
| `change-stat-free` | Bond | Change declared stat to any of the three |
| `change-stat-to-power` | Gladiator | Force stat to power specifically |
| `immediate-nullify-all` | Samurai | `onReveal`: nullify ALL opponents' abilities |
| `immediate-nullify-group-or-draw` | Priest | `onReveal`: nullify devil-group abilities OR draw a card |
| `copy-ability` | Devil | Borrow a card's ability from any player's loser pile |
| `recover-loser-to-hand` | Angel | Return a card from your own loser pile to hand |
| `force-extra-battle` | Captain | Add top-deck card to battle; use summed stat values |
| `force-opponent-discard` | Executor | Target player sends a hand card to their loser pile |
| `buff-next-battle` | Sensei | +1 all stats on your next battle's Crok |
| `conditional-power-boost` | Sumo | +2 power if intelligence beats all opponents' |
| `trigger-vakharc-on-loss` | Pancrator | If this loses → next battle is forced Vakharc, you pick stat |
| `scale-with-opponents` | Army | All stats +N per opponent (swaps count) |
| `attacker-plus-reflex` | Boy | Become attacker next round; +2 reflex when defending |
| `deficit-buff` | Cave | All stats +N where N = opponent wins minus your wins |
| `sacrifice-power` | Karate | Discard hand card; use its power stat this battle |
| `deck-scry` | Indian | See and reorder top 6 deck cards |
| `winning-override-copy` | Police | Win by discarding a copy of an opponent's played card |
| `winning-override-on-tie` | Sheriff | Win if the stat result is currently a tie |

## Database schema (planned)

### `profiles`
```sql
id uuid PK → auth.users
username text UNIQUE NOT NULL
avatar_url text
wins int DEFAULT 0
created_at timestamptz
```

### `matches`
```sql
id uuid PK
players uuid[]              -- ordered clockwise; players[0] is original attacker
status match_status         -- 'waiting' | 'active' | 'finished'
attacker_index int          -- current attacker (index into players[])
state jsonb                 -- full GameState blob
winner_id uuid
created_at timestamptz
updated_at timestamptz
```

RLS: only players in the `players` array may read or update their own match.

### `profiles` RLS
- Anyone can read profiles (for lobby display).
- Users may only update their own profile.

## Move validation

Moves are validated server-side in the `play-move` Edge Function to prevent cheating on the face-down commit step. The client sends a **move action** (not raw state); the function validates, advances state, and writes back to `matches.state`. Realtime triggers push the new state to all players.

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Set in `.env.local` for development (gitignored). Set as Cloudflare Pages environment variables for production.

## Locked decisions

| Topic | Decision |
|---|---|
| Player count | **N-player** (min 2), clockwise turn order |
| Auth | Supabase Auth, **username + password** |
| Matchmaking | **Invite link** (host creates match → shareable link/code → others join) |
| Integrity | **Server-authoritative**: clients send move *actions*; the `play-move` Edge Function validates and advances state |
| Card data | Complete — `src/data/cards.json` (21 cards) + images in `public/cards/` |
| Master Crok | Unique, **groupless** — never counts toward group-victory |
| Captain Crok | Per-player sum of own two cards in declared stat; compare totals |
| Karate Crok | Sacrificed card's power **replaces** Karate's power |

---

# Implementation plan

> **Status: Phases 0–7 implemented.** Engine has 22 passing Vitest tests; `tsc`
> and `vite build` are green. Remaining work is operational (provision a real
> Supabase project + deploy) and the post-MVP backlog below.

Phased so the game is **playable end-to-end as early as possible**, then deepened. Each phase ends in a committable, verifiable state. The pure engine is the spine: it has zero Supabase/React imports and is fully unit-testable in isolation, then reused identically on the client (optimistic preview) and in the Edge Function (authority).

## Phase 0 — Project skeleton
**Goal:** `npm run dev` serves a blank Tailwind app; `npm test` runs.
- Vite + React + TS scaffold; `package.json`, `tsconfig.json`, `vite.config.ts`.
- Tailwind + PostCSS config; base styles.
- Vitest + setup for engine unit tests.
- `src/lib/supabaseClient.ts` reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `.env.example`.
- `_redirects` for Cloudflare SPA fallback.
- **Verify:** dev server boots, empty test suite green.

## Phase 1 — Types & card data binding
**Goal:** strongly-typed access to the card DB.
- `src/types/card.ts`: `StatKey` (`'power'|'intelligence'|'reflex'`), `GroupSlug` (union of the 10 group keys), `Ability` (name, nameEn, textHu, textEn, `archetype`, `trigger`, `optional`), `CrokCard` (`group: GroupSlug | null`).
- `src/types/game.ts`: `PlayerState`, `GameState`, `Move`, `BattleState`, `DuelResult`, `Phase` (see Data model below).
- `src/data/cards.ts`: import `cards.json`, validate shape at module load (dev-time assert), export `CARDS: CrokCard[]` and `cardById` / `cardBySlug` maps.
- **Verify:** a test asserts all 21 cards load, ids 1–21 unique, every `group` is a known slug or null, every `archetype` is registered.

## Phase 2 — Pure engine (no abilities yet)
**Goal:** a full game playable with **vanilla stat comparison only** (abilities stubbed as no-ops), driven entirely by `applyMove(state, move)`.
- `src/engine/deck.ts`: `validateDeck(cards)` → min 10, copy limit `floor(size/10)` per **named card**; `shuffle(deck, seed)` (seeded PRNG so server & client agree).
- `src/engine/state.ts`: `createGame(players, decks, seed)`, `applyMove(state, move, byPlayerId)` reducer — the single source of truth for transitions. Pure, deterministic, returns new state + validation errors.
- `src/engine/duel.ts`: `resolveBattle(state)` → compares the declared stat across all committed cards, returns `DuelResult` (winnerId | tie), with **effective stats** hook (abilities plug in later).
- `src/engine/winCondition.ts`: `groupVictoryCount(player)` = distinct non-null groups in winner pile; `checkWinCondition(state)` → primary (≥6 distinct groups) and alternate end (a player has emptied deck **and** hand → most winners wins).
- **Battle flow implemented:** draw → declare stat → commit (face-down) → reveal → [ability phase = no-op for now] → resolve → distribute to winner/loser piles → tie → Vakharc (recursive) → next attacker.
- **Verify (unit tests):** deck validation cases; a scripted 2- and 3-player game runs to a group-victory; tie triggers Vakharc; Vakharc chains; alternate-end fires on deck+hand exhaustion.

## Phase 3 — Ability engine
**Goal:** the interactive clockwise ability loop with reserve/immediate/swap, then all 21 abilities.
- `src/engine/abilities.ts`: registry keyed by `archetype` → handler implementing the relevant hook(s):
  ```
  onBattleStart · onReveal · onAbilityPhase · onResolve · onWinningOverride · afterBattle
  ```
- **Ability loop** (in `state.ts`): starting at attacker, clockwise; each player may `use` / `skip` / `reserve` their ability (once). `Azonnal` abilities (`immediate-*`) fire at `onReveal` out of order. Swaps (`swap-*`, `force-opponent-deck-swap`) and reactive plays reopen the loop; loop ends when all players have used or permanently declined. Reserve cost = move one winner → loser pile, earns another pass.
- **Winning overrides** (`winning-override-copy` Police, `winning-override-on-tie` Sheriff) resolved before stat comparison via `onWinningOverride`.
- **Effective-stat modifiers** (Sumo, Army, Cave, Boy, Sensei buff, Karate, Gladiator/Bond stat-change, Captain sum) computed as layered modifiers feeding `resolveBattle`.
- **Cross-battle effects:** Sensei (`buff-next-battle`), Pancrator (`trigger-vakharc-on-loss`), Boy (`attacker-plus-reflex` next-round attacker) stored on `PlayerState` / `GameState` and consumed next battle.
- **Implementation order within the phase** (simple → complex):
  1. Stat math: Sumo, Army, Cave, Sensei, Boy, Gladiator, Bond, Captain, Karate.
  2. Pile/hand manip: Angel, Executor, Funny, Indian (scry), Jungle (blind deck swap), Master (hand swap).
  3. Overrides & meta: Samurai/Priest nullify, Police, Sheriff, Devil (copy-ability), Pancrator.
- **Verify:** one focused unit test per archetype; an integration test that runs a multi-ability battle (swap → reopen loop → nullify → override).

## Phase 4 — Persistence & realtime
**Goal:** two browsers play the same match in real time.
- `supabase/migrations/0001_profiles.sql`, `0002_matches.sql`, `0003_rls_policies.sql` (schema below); enable `matches` in the Realtime publication; `updated_at` trigger.
- `supabase/functions/play-move/index.ts`: receives `{ matchId, move }`, loads `state`, calls the **same** `applyMove`, writes new `state` (+ `winner_id`, `status`), returns it. Rejects illegal/out-of-turn moves.
- `src/hooks/useMatch.ts`: initial fetch → subscribe to `postgres_changes` on the row → expose `state`, `loading`, `error`, `isMyTurn`, and action helpers (`declareStat`, `commitCard`, `useAbility`, `reserve`, `skip`, `resolve`) that call the Edge Function. Stale-write guard via `updated_at`.
- **Verify:** scripted move sequence applied through the function reproduces engine test results; manual two-tab smoke test.

## Phase 5 — UI components
**Goal:** the board renders state and dispatches actions.
Build bottom-up: `StatBadge` → `CrokCard` (uses `/cards/NNN.jpg`, `faceDown` prop, ability footer) → `Hand` (own = face-up & selectable, opponents = face-down counts) → `WinPile` / `LoserPile` (visible, group-victory tally) → `DuelZone` (committed cards, declared stat, ability-phase controls: use/skip/reserve, swap target pickers) → `GameBoard` (N-player seating, opponents around top/sides, you at bottom).
- **Verify:** Storybook-less manual pass; board renders a mid-game `GameState` fixture correctly, including face-down opponents and a tie/Vakharc state.

## Phase 6 — Auth, lobby, matchmaking
**Goal:** sign in and get two players into a match via link.
- Username/password auth screens; create `profiles` row on signup.
- `src/pages/Lobby.tsx`: create match (host) → generates invite link/code; join via link. Deck selection (MVP: a default legal deck per player; custom deck builder is post-MVP).
- `src/pages/Match.tsx`: wires `useMatch` + `GameBoard`; handles waiting → active → finished.
- **Verify:** end-to-end on two machines/tabs: sign in, host, share link, join, play to a win.

## Phase 7 — Deploy
- Cloudflare Pages build config; env vars; `_redirects` verified.
- Supabase project: run migrations, deploy `play-move`, set auth to username/password.
- **Verify:** production URL playable.

## Data model (GameState blob)

```ts
type Phase = 'lobby' | 'draw' | 'declare' | 'commit' | 'reveal'
           | 'ability' | 'resolve' | 'vakharc' | 'finished';

interface PlayerState {
  userId: string;
  deck: number[];           // card ids, top = index 0 (server-only order; clients see counts)
  hand: number[];           // card ids (own hand visible only to owner via RLS-filtered view or client trust)
  committed?: number | null;// card id played face-down this battle
  winners: number[];        // winner pile (card ids) — group-victory derived from this
  losers: number[];         // loser pile (card ids)
  pendingBuffs?: {           // cross-battle effects
    senseiAllStats?: number; // +1 next battle
    nextRoundAttacker?: boolean;
  };
  abilityUsed?: boolean;     // used this battle
  abilityReserved?: boolean; // reserved (gets another pass)
}

interface BattleState {
  declaredStat: StatKey;
  attackerId: string;
  abilityCursor: string;     // whose ability turn (clockwise)
  nullifiedGroups?: GroupSlug[]; // from Priest
  nullifyAll?: boolean;          // from Samurai
  forcedNextVakharc?: { byPlayerId: string }; // Pancrator
  log: string[];
}

interface GameState {
  matchId: string;
  players: PlayerState[];        // clockwise order; players[0] = original attacker
  attackerIndex: number;
  phase: Phase;
  battle?: BattleState;
  vakharcDepth: number;          // recursive tie nesting
  seed: number;                  // for deterministic shuffles
  winnerId?: string;
  version: number;               // optimistic-concurrency / stale-write guard
}

type Move =
  | { type: 'declareStat'; stat: StatKey }
  | { type: 'commitCard'; cardId: number }
  | { type: 'useAbility'; payload?: AbilityPayload }   // target picks, choices
  | { type: 'reserveAbility' }
  | { type: 'skipAbility' }
  | { type: 'resolve' }
  | { type: 'commitVakharc' };
```

> **Hidden information note:** with a single `state` JSONB, a player could inspect opponents' hands/decks via devtools. MVP accepts this (trusted friends over an invite link) but the Edge Function is the authority for *legality*. Post-MVP hardening: per-player redacted state views, or move hands/decks to server-only and push redacted snapshots.

## Testing strategy
- **Engine unit tests (Vitest):** deck validation, each ability archetype, win conditions, Vakharc recursion, alternate end. This is where correctness lives.
- **Integration test:** full scripted N-player game through `applyMove`, then the identical sequence through `play-move` to prove client/server parity.
- **Manual:** two-tab realtime smoke test per phase 4+.

## Post-MVP backlog
Custom deck builder + saved decks; spectator mode; reconnection/resume; hidden-info hardening; animations; more card sets (data is additive — append to `cards.json` + drop `NNN.jpg`); ranked/queue matchmaking; profile stats.
