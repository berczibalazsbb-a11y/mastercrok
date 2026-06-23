# Card images

These are the visual assets for each Crok card, served statically by Vite at
`/cards/<filename>` and referenced by the `image` field in
[`src/data/cards.json`](../../src/data/cards.json).

## Why this folder is (mostly) empty

The card images cannot be fetched automatically — the source sites
(mastercrok.blogspot.com, mastercrokccg.wordpress.com) return **HTTP 403** to
every automated request, and chat-attached images cannot be written to the repo
by the assistant. **The image files must be added here by hand.**

## Naming convention

`NN-slug.jpg` — zero-padded set number + the card `slug` from `cards.json`:

| File | Card |
|---|---|
| `01-master-crok.jpg` | Master Crok (1/21) |
| `02-bond-crok.jpg`   | Bond Crok (2/21) |
| `03-devil-crok.jpg`  | Devil Crok (3/21) |
| `04-samurai-crok.jpg`| Samurai Crok (4/21) |
| `05-angel-crok.jpg`  | Angel Crok (5/21) |
| `06-…` … `21-…`      | pending |

## How to add images

1. Save each scan with the exact filename above (jpg or png — if png, update the
   `image` path in `cards.json`).
2. Drop the file into this `public/cards/` folder.
3. Flip `"imagePresent": false` → `true` for that card in `cards.json`.
4. Commit. Vite serves it at `/cards/NN-slug.jpg`; `CrokCard.tsx` renders it.

Keep images reasonably sized (≈ 400–600px wide) so the board stays light.
