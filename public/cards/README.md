# Card images

Visual assets for each Crok card, served statically by Vite at `/cards/<filename>`
and referenced by the `image` field in
[`src/data/cards.json`](../../src/data/cards.json).

## Status: complete

All 21 base-set images are present.

## Naming convention

`NNN.jpg` — the zero-padded card `id` from `cards.json`:

| File | Card |
|---|---|
| `001.jpg` | Master Crok (1/21) |
| `002.jpg` | Bond Crok (2/21) |
| …         | … |
| `021.jpg` | Sheriff Crok (21/21) |

## Adding more cards later

Card data is additive: append the entry to `cards.json` (next `id`), then drop
`NNN.jpg` here with the matching zero-padded id and set `"imagePresent": true`.
Vite serves it at `/cards/NNN.jpg`; `CrokCard.tsx` renders it.

Keep new images reasonably sized so the board stays light.
