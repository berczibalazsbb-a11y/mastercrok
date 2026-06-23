# Master Crok — Project Guide

## What this is

Real-time multiplayer web implementation of the Hungarian trading card game "Master Crok" (Chio © 2001). N-player (min 2), browser-based, powered by Supabase Realtime.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Styling | Tailwind CSS |
| Backend / sync | Supabase (Postgres + Realtime WebSockets) |
| Auth | Supabase Auth (TBD: anonymous / magic-link / OAuth) |
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

The physical set is **21 cards** (numbered 1/21–21/21, Chio © 2001). The live card database sites return HTTP 403 to automated fetches. **Card data must be entered manually** into `src/data/cards.ts`.

### Known cards (from scans + rules text)

| # | Name | Group | Power | Int | Reflex | Ability name | Ability text (HU) |
|---|---|---|---|---|---|---|---|
| 1 | Master Crok | unknown-dots (arc of dots) | 8 | 7 | 9 | Váratlan csapás | Kicserélheted egy másik, a kezedben levő Crokra, ha az nem Master Crok. |
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

**11 groups** (2 cards each except ninja which has 1): ninja · spy · devil · yin-yang · angel · pirate · jungle · sumo · lightning · flower · sheriff

### Canonical card data lives in JSON
The source of truth is **`src/data/cards.json`** (validated by `src/data/cards.schema.json`). `src/data/cards.ts` will import and type-narrow this JSON into `CrokCard[]`. To add a card, append an entry to `cards.json` following the schema, then add its image (see `public/cards/README.md`). Group values are slugs keyed into the `groups` map (e.g. `"spy"`, `"devil"`, `"angel"`, `"yin-yang"`).

### Card image assets
Images are static files in **`public/cards/`** named `NN-slug.jpg`, referenced by each card's `image` field and rendered by `CrokCard.tsx`. They must be added manually — the source sites 403 automated fetches and chat-attached images can't be written to the repo by the assistant.

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

## Open questions (answers needed before implementation)

- [ ] **Auth method:** anonymous / email magic-link / OAuth?
- [ ] **Matchmaking:** room code / invite link / random queue?
- [ ] **Card data:** paste full 21-card list with stats + ability texts.
- [ ] **Ability phase detail for Devil Crok:** which pile counts as "opponent's losing Croks" — any player's loser pile, or specifically the player who just lost this battle?
- [ ] **Bond Crok timing:** fired during `onAbilityPhase` (after reveal) — but the rules imply Bond is a *reactive* play to an opponent's swap. Confirm ability fires post-reveal and not pre-commit.

## Build order

1. Vite + React + TS + Tailwind init; Supabase client; env wiring
2. SQL migrations + RLS (run via Supabase CLI or dashboard)
3. TypeScript types (`card.ts`, `game.ts`)
4. Pure engine: `deck.ts` → `duel.ts` → `abilities.ts` → `winCondition.ts` + unit tests
5. Card data entry (manual — requires card list from you)
6. `useMatch` hook + `play-move` Edge Function
7. UI components: `StatBadge` → `CrokCard` → `Hand` → `WinPile` → `DuelZone` → `GameBoard`
8. Pages: `Lobby` → `Match`
9. Cloudflare Pages deploy config + `_redirects`
