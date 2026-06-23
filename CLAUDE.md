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
│
├── .github/
│   └── workflows/
│       └── deploy.yml                # Cloudflare Pages CD on push to main
│
├── public/
│   ├── _redirects                    # Cloudflare Pages SPA fallback (/* → /index.html 200)
│   └── cards/                        # 001.jpg … 021.jpg
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
    ├── vite-env.d.ts
    ├── lib/
    │   ├── supabaseClient.ts
    │   ├── auth.ts                   # signUp / signIn / signOut; username → email bridge
    │   └── matches.ts                # createMatch / joinMatch / startMatch; DEFAULT_DECK
    ├── types/
    │   ├── card.ts                   # CrokCard, StatKey, Group, Ability, AbilityArchetype
    │   └── game.ts                   # PlayerState, GameState, Move, BattleState, DuelResult
    ├── data/
    │   ├── cards.json                # canonical 21-card DB (source of truth)
    │   ├── cards.schema.json         # JSON schema for cards.json
    │   └── cards.ts                  # typed re-export; getCard(), CARDS[]
    ├── engine/
    │   ├── rng.ts                    # mulberry32 PRNG + Fisher-Yates shuffle
    │   ├── deck.ts                   # validateDeck()
    │   ├── duel.ts                   # baseValue(), compareValues(), resolveBattle()
    │   ├── abilities.ts              # canUseAbility, applyAbility, applyImmediateAbilities
    │   ├── state.ts                  # createGame(), applyMove() — single source of truth
    │   ├── winCondition.ts           # groupVictoryCount(), checkWinCondition()
    │   └── selectors.ts              # pendingActors(), isMyTurn(), phaseHint()
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useMatch.ts               # Realtime game-engine hook
    ├── components/
    │   ├── CrokCard.tsx
    │   ├── GameBoard.tsx
    │   ├── Hand.tsx
    │   ├── DuelZone.tsx
    │   └── WinPile.tsx
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

The physical set is **21 cards** (numbered 1/21–21/21, Chio © 2001). All card data has been entered manually from scans. **The complete data set is committed** in `src/data/cards.json` and all 21 images are present in `public/cards/`.

### Known cards (all 21 — source of truth is `src/data/cards.json`)

| # | Name | Group | Power | Int | Reflex | Ability name | Ability text (HU) |
|---|---|---|---|---|---|---|---|
| 1 | Master Crok | **none (unique, groupless)** | 8 | 7 | 9 | Váratlan csapás | Kicserélheted egy másik, a kezedben levő Crokra, ha az nem Master Crok. |
| 2 | Bond Crok | spy (revolver) | 5 | 6 | 7 | Trükkös fordulat | Megváltoztathatod a harc típusát: erő, intelligencia vagy reflex. |
| 3 | Devil Crok | devil (trident) | 6 | 6 | 6 | Lélekrablás | Használhatja egy másik játékos, egyik vesztes Crokjának képességét. |
| 4 | Samurai Crok | yin-yang | 6 | 4 | 8 | Első vágás | Azonnal hatástalanítja az ellenfelek képességeit. (immediate / nullify) |
| 5 | Angel Crok | angel (winged cross) | 3 | 4 | 7 | Feltámasztás | Visszaveheted a kezedbe egy vesztes Crokodat. |
| 6 | Captain Crok | pirate (compass rose) | 5 | 6 | 3 | Nagy ütközet | Everyone adds top-deck card to battle; sum of stat values is used. |
| 7 | Executor Crok | devil (trident) | 7 | 4 | 3 | Nincs kegyelem | **Target player chooses** a hand card to send to their loser pile. |
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
The source of truth is **`src/data/cards.json`** (validated by `src/data/cards.schema.json`). `src/data/cards.ts` imports and type-narrows this JSON into `CrokCard[]`. To add a card, append an entry to `cards.json` following the schema, then add its image. Group values are slugs keyed into the `groups` map (or `null` for a unique groupless card).

### Card image assets
All 21 images are committed in **`public/cards/`** named `NNN.jpg` (zero-padded card id, e.g. `001.jpg` = Master Crok, `021.jpg` = Sheriff Crok), referenced by each card's `image` field and rendered by `CrokCard.tsx`.

### Resolved ability ambiguities (per owner decision)
- **Captain Crok (`force-extra-battle`):** each player sums their own two cards' value in the declared stat (played card + revealed top-deck card); totals are compared. Players with empty decks contribute only their played card.
- **Karate Crok (`sacrifice-power`):** the sacrificed hand card's power **replaces** Karate's own power (not additive) for this battle.
- **Executor Crok (`force-opponent-discard`):** the **targeted player** chooses which of their hand cards to discard (not the Executor owner). Implemented via `pendingVictimDiscard` on `BattleState` and the `chooseDiscard` move.

## Ability system

Abilities are implemented in `src/engine/abilities.ts`. The engine has three entry points consumed by `state.ts`:
- `canUseAbility(state, playerId)` — whether the player's committed card has a usable loop ability right now
- `applyImmediateAbilities(state)` — fires `immediate-*` abilities at reveal, out of loop order (Samurai, Priest)
- `applyAbility(state, playerId, payload)` — applies the player's loop ability; called from the `useAbility` move

And one entry point consumed by `duel.ts`:
- `effectiveValue(base, state, playerId, stat)` — adds `battleMods` on top of the base stat value

### Ability archetypes

| Archetype | Card | Notes |
|---|---|---|
| `swap-from-hand` | Master | Replace committed card with a hand card |
| `swap-from-deck-blind` | Jungle | Replace committed card with top of own deck |
| `force-opponent-deck-swap` | Funny | Force an opponent to swap their card for the bottom of their deck |
| `change-stat-free` | Bond | Change declared stat to any of the three |
| `change-stat-to-power` | Gladiator | Force stat to power specifically |
| `immediate-nullify-all` | Samurai | At reveal: nullify ALL opponents' abilities this battle |
| `immediate-nullify-group-or-draw` | Priest | At reveal: nullify devil-group abilities, or draw 1 card |
| `copy-ability` | Devil | Borrow a loop ability from any player's loser pile |
| `recover-loser-to-hand` | Angel | Return a chosen card from own loser pile to hand |
| `force-extra-battle` | Captain | Reveal top-deck card; use summed stat values this battle |
| `force-opponent-discard` | Executor | **Victim chooses** which hand card to discard to their loser pile |
| `buff-next-battle` | Sensei | +1 all stats on own Crok in the next battle |
| `conditional-power-boost` | Sumo | +2 power if own intelligence beats all opponents' |
| `trigger-vakharc-on-loss` | Pancrator | If this card loses → next battle starts as Vakharc |
| `scale-with-opponents` | Army | +N to all stats, N = number of opponents with committed cards |
| `attacker-plus-reflex` | Boy | Become attacker next round; +2 reflex when defending this battle |
| `deficit-buff` | Cave | +N all stats, N = (chosen opponent wins) − (own wins) |
| `sacrifice-power` | Karate | Discard a hand card; its power stat replaces Karate's power |
| `deck-scry` | Indian | View and freely reorder the top 6 cards of own deck |
| `winning-override-copy` | Police | Win if you discard a copy of an opponent's committed card |
| `winning-override-on-tie` | Sheriff | Win if the current stat result is a tie |

## Database schema

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
invite_code text UNIQUE
host_id uuid
created_at timestamptz
updated_at timestamptz      -- auto-updated by trigger; used as stale-write guard
```

RLS: only players in the `players` array may read or update their own match.

### `profiles` RLS
- Anyone can read profiles (for lobby display).
- Users may only update their own profile.

## Auth

Username/password login. Supabase Auth doesn't support username-only sign-up natively, so usernames are mapped to synthetic emails (`username@crok.local`) by `src/lib/auth.ts`. Email confirmation is disabled in the Supabase project settings.

## Move validation

Moves are validated server-side in the `play-move` Edge Function. The client sends a **move action** (not raw state); the function validates, advances state, and writes back to `matches.state`. Realtime triggers push the new state to all players.

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Set in `.env.local` for development (gitignored). Set as Cloudflare Pages environment variables for production.

## Cloudflare Pages deployment

Build command: `npm run build`  
Output directory: `dist`  
`public/_redirects` contains `/* /index.html 200` for SPA routing.

**Manual deploy:**
```bash
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=<account_id>
npm run build
npx wrangler pages deploy dist --project-name mastercrok --branch main
```

**CI deploy:** `.github/workflows/deploy.yml` fires on push to `main` using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets set in the GitHub repository.

Required Cloudflare API token scopes: `Cloudflare Pages: Edit` + `Account: Read`.

## Locked decisions

| Topic | Decision |
|---|---|
| Player count | **N-player** (min 2), clockwise turn order |
| Auth | Supabase Auth, **username + password** (email synthesised as `username@crok.local`) |
| Matchmaking | **Invite link** (host creates match → shareable link/code → others join) |
| Integrity | **Server-authoritative**: clients send move *actions*; the `play-move` Edge Function validates and advances state |
| Card data | Complete — `src/data/cards.json` (21 cards) + images in `public/cards/` |
| Master Crok | Unique, **groupless** — never counts toward group-victory |
| Captain Crok | Per-player sum of own two cards in declared stat; compare totals |
| Karate Crok | Sacrificed card's power **replaces** Karate's power |
| Executor Crok | **Victim chooses** which hand card to discard (two-step: owner picks target → victim picks card via `chooseDiscard` move) |
| Default deck | 1 copy of each of the 21 cards (`DEFAULT_DECK = [1…21]`) — no custom deck builder in MVP |
| Hidden info | Single JSONB blob accepted for MVP (trusted friends); post-MVP: per-player redacted views |

---

# Implementation status

> **All phases complete. 27 Vitest engine tests pass; `tsc` and `vite build` are green.**

## Phase 0 — Project skeleton ✅
Vite + React + TS scaffold, Tailwind + PostCSS, Vitest, `supabaseClient.ts`, `.env.example`, `public/_redirects`.

## Phase 1 — Types & card data binding ✅
`src/types/card.ts`, `src/types/game.ts`, `src/data/cards.json` (21 cards), `src/data/cards.ts`. All 21 cards load; ids 1–21 unique; every group and archetype is registered (verified by test).

## Phase 2 — Pure engine ✅
`rng.ts` (mulberry32 + Fisher-Yates), `deck.ts` (validateDeck), `state.ts` (createGame + applyMove), `duel.ts` (baseValue + compareValues), `winCondition.ts`.
Full battle loop: draw → declare → commit → reveal → ability → resolve → winner/loser piles → tie → Vakharc (recursive) → next attacker.

## Phase 3 — Ability engine ✅
All 21 ability archetypes implemented in `abilities.ts`. Clockwise ability loop with use/skip/reserve (tartalékolás). Immediate abilities (Samurai, Priest) fire at reveal. Cross-battle effects: Sensei buff consumed into `battleMods` at next-battle start; Pancrator forces Vakharc via `forcedNextVakharc`; Boy sets next-round attacker via `pendingBuffs.nextRoundAttacker`.
Executor uses a two-step flow: `useAbility` sets `pendingVictimDiscard` on `BattleState`; victim submits `chooseDiscard`.

## Phase 4 — Persistence & realtime ✅
Supabase migrations (`0001_profiles`, `0002_matches`, `0003_rls_policies`). `play-move` Edge Function. `useMatch` hook with Realtime subscription and optimistic state application.

## Phase 5 — UI components ✅
`CrokCard`, `Hand` / `OpponentHand`, `WinPile` / `LoserPile`, `DuelZone` (all ability pickers, victim discard panel), `GameBoard`.

## Phase 6 — Auth, lobby, matchmaking ✅
`useAuth`, `src/lib/auth.ts`, `src/lib/matches.ts`. `Lobby.tsx` (create/join by invite code). `Match.tsx` (waiting room + live game).

## Phase 7 — Deploy ✅ (config) / pending (provision)
GitHub Actions workflow at `.github/workflows/deploy.yml` builds and deploys to Cloudflare Pages on push to `main`. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.
Supabase project still needs provisioning: run migrations + deploy `play-move` + disable email confirmation + set env vars in Cloudflare Pages.

---

# Canonical data model

```ts
type Phase = 'lobby' | 'draw' | 'declare' | 'commit' | 'reveal'
           | 'ability' | 'resolve' | 'vakharc' | 'finished';

interface PendingBuffs {
  senseiAllStats?: number;      // +N to all stats on next committed Crok
  nextRoundAttacker?: boolean;  // Boy: become attacker next round
}

interface BattleMods {
  power: number;
  intelligence: number;
  reflex: number;
}

interface PlayerState {
  userId: string;
  deck: number[];               // card ids; index 0 = top
  hand: number[];               // card ids
  committed: number | null;     // card id played face-down
  extraCommitted: number | null;// Captain Grand Battle extra card
  winners: number[];
  losers: number[];
  pendingBuffs: PendingBuffs;
  battleMods: BattleMods;       // accumulated ability modifiers this battle
  abilityUsed: boolean;
  abilityReserved: boolean;
}

interface BattleState {
  declaredStat: StatKey;
  attackerId: string;
  abilityCursor: string;        // whose ability turn in the clockwise loop
  nullifiedGroups: string[];    // Priest: groups nullified this battle
  nullifiedPlayers: string[];   // Samurai: player ids nullified this battle
  forcedWinnerId: string | null;// Police / Sheriff winning-override
  grandBattle: boolean;         // Captain: use summed stat values
  pendingVictimDiscard: {       // Executor: victim must choose via chooseDiscard
    executorPlayerId: string;
    targetPlayerId: string;
  } | null;
  log: string[];
}

interface GameState {
  matchId: string;
  players: PlayerState[];       // clockwise; players[0] = original attacker
  attackerIndex: number;
  phase: Phase;
  battle: BattleState | null;
  vakharcDepth: number;
  forcedNextVakharc: { byPlayerId: string } | null; // Pancrator
  seed: number;
  winnerId: string | null;
  version: number;              // stale-write guard
}

type Move =
  | { type: 'declareStat'; stat: StatKey }
  | { type: 'commitCard'; cardId: number }
  | { type: 'commitVakharc'; cardId: number }
  | { type: 'useAbility'; payload?: AbilityPayload }
  | { type: 'reserveAbility' }
  | { type: 'skipAbility' }
  | { type: 'resolve' }
  | { type: 'chooseDiscard'; cardId: number };  // Executor victim's card choice
```

---

# Testing strategy
- **Engine unit tests (Vitest):** deck validation, each ability archetype, win conditions, Vakharc recursion, alternate end. This is where correctness lives.
- **Integration test:** full scripted game through `applyMove`, then the same sequence through `play-move` to prove client/server parity.
- **Manual:** two-tab realtime smoke test.

---

# Post-MVP backlog
Custom deck builder + saved decks; spectator mode; reconnection/resume; hidden-info hardening (per-player redacted state); animations; more card sets (data is additive — append to `cards.json` + drop `NNN.jpg`); ranked/queue matchmaking; profile stats.
