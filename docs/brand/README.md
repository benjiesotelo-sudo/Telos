# Telos brand kit

The Telos identity is dual, like a wordmark-plus-symbol pair: the **wordmark** and the **mark**.
Both were tuned and approved by Benjamin Sotelo (2026-07-10) via an interactive geometry tuner; the exact parameters live in `geometry.json` and are the single source of truth.

## The mark

Three nodes on a path: two open ink nodes, a closed clay node at the arrival.
Three nodes always, one mark at every size, no arrowheads.

Tuned parameters (from `geometry.json`): stance 71, peak 30, node radius 6.5, arrival radius 9.5, ink stroke 2.5, clay stroke 4.3.
Construction rule for clean junctions: lines are drawn first (butt caps, trimmed into the ring centerline), circles painted on top.

Files:

- `telos-mark.svg` - ink strokes use `currentColor`, clay is `#d97757`. Use this wherever CSS color context exists (it themes itself).
- `telos-mark-light.svg` / `telos-mark-dark.svg` - fixed-ink variants for contexts without CSS color (GitHub README `<picture>`, external docs).
- `favicon.svg` - the mark centered on a square viewBox, shipped as `public/favicon.svg`.

In the app, the mark is the `TelosMark` React component (`src/components/TelosMark.tsx`), which inlines the same geometry with `currentColor` ink and `var(--accent)` clay so both themes work with one asset.

## The wordmark (W1)

The wordmark is live text, not an image: **Telos.** set in Crimson Pro weight 620 with the full stop in clay (`--accent`, `#d97757`).
It appears on the Welcome screen; the clay full stop is the wordmark's signature and always ships with it.

## Color

Clay `#d97757` and the ink/paper neutrals come from `src/styles/tokens.css`, which is the source of truth; do not copy hex values from this document into code.
