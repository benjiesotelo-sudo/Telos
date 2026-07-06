# Slice 4 (responsive resilience) - build ratify

Date: 2026-07-06
Spec `2026-07-06-telos-responsive-resilience-design.md` (R1-R5) · plan `2026-07-06-telos-responsive-resilience.md` · ledger `.superpowers/sdd/progress.md`.
Local main `ddb9b02` (+ this doc), NOT pushed - your word, as always.

## Gate (at ddb9b02)

test:fast 1185/1185 · tsc -b / build clean · Playwright **36/36** in 5.6 min (desktop 19 · mobile 1 · tablet 1 · responsive 9 · visual 6) · fresh-clone green.

## What shipped

- A PERMANENT overflow auditor: 5 screens x 7 widths (320-1280) asserting the page body never side-scrolls, plus a long-column-name stress test at 320px.
- Real fixes it forced: `.chip` now wraps long unbroken column names (a 489px overflow at 320px, found RED-first); APA tables scroll inside their own container; figures are responsive (`img{max-width:100%}` - a fixed 480px image was silently overflowing results on phones, found by extending the audit to the live results screen inside the flow journey).
- Hover affordances (rail underline/lift AND the slot-to-shelf echo) now fire only on hover-capable devices - your iPad gets touch behavior despite its width.
- The sticky-rail-under-scroll assertion (the bug you caught can never return silently).
- A permanent tablet Playwright project (834x1112, touch) running the touch journey.
- 30 visual baselines (5 screens x desktop/tablet/phone x light/dark) with proven pixel determinism - from now on, "it looks different" is a red test until you approve the new look via a baseline update.

## Notes for your click-through

- N1: Long column names now WRAP inside chips (taller pill instead of overflow) - upload a CSV with a long header and see if the look is acceptable.
- N2: Baselines pin the reduced-motion resting frame; the animated path itself is outside baseline coverage (recorded spec limitation).
- N3: WebR-heavy e2e specs are contention-sensitive at 4 parallel workers (one transient flake this gate, re-verified clean twice) - if it recurs next gate, we cap workers for those specs rather than tolerate it.

## Acceptance

`npm run build && npm run preview` - then grab the window edge and drag from very narrow to full-screen on every screen: no horizontal scrollbar should ever appear. iPad pass if handy (hover cues should be absent, tap-to-assign present).
Baseline-update protocol from here on: any intentional visual change re-runs `npx playwright test --project=visual --update-snapshots` and YOU approve the diffs.
