# Slice 3 (polish, onboarding & mobile) - build ratify

Date: 2026-07-05
Spec `2026-07-05-telos-polish-onboarding-mobile-design.md` (R1-R6, all owner-picked) · plan `2026-07-05-telos-polish-onboarding-mobile.md` · SDD ledger `.superpowers/sdd/progress.md`.
Local main `0764414`, NOT pushed.

## Gate

test:fast 1185/1185 (140 files) · tsc -b / build clean · Playwright 20/20 full parallel run in 5.9 min (19 desktop + the new mobile project) · fresh-clone ci + fast + build green.

## What shipped

Test-switcher pills on every config screen (clay check on configured tests, ink pill current, finger-sized; sub-dots are desktop-only indicators now).
First-run hint bar under the rail (dismiss on X or first rail jump, session-scoped) + hover/focus affordances on the rail.
Motion register live: welcome entrance stagger, stage-completion check pop + fill surge, 150ms screen cross-fades, chip settle - all dead under Reduce Motion.
Mobile: one-line compact rail, 24px hit targets everywhere (incl. chip remove buttons), the configure-data table scrolls inside its card, tap-to-assign (tap a chip, tap a slot) alongside drag, and a mobile Playwright project covering the journey.
Catalog short names for every long test name.

## The gate earned its keep (for the record)

- Caught a REAL product regression before you ever saw it: the first 24px hit-area attempt used overlapping invisible halos on the tiny rail dots - clicking a dot activated its neighbor. Rebuilt as real 24px buttons with painted dots; proven by element-hit tests.
- Unmasked a PRE-EXISTING e2e false-pass: drag checks could match a slot's hint text (e.g. "month, year" matching a dropped "year"). All 8 drag helpers now confirm the drop landed on the assigned chip itself and retry under parallel load.
- Found that dnd-kit's bare pointer sensor swallowed ALL taps (tap-to-assign would have been dead on arrival) - fixed with the standard activation-distance pattern; drag behavior verified unchanged.

## Your calls at click-through (C-list)

- C1: Theme-select overlaps the compact rail's fraction counter on narrow phones (pre-existing fixed control). Candidate fix: rail top-padding clears it at the cost of ~28px vertical. Look at it on a phone and rule.
- C2: The completion check "pops" again when you navigate backward and forward past a completed stage (and assigned chips re-settle when switching test screens). Mount-triggered animations replay by design; a "once per session" polish is possible if it bothers you live.
- C3: Tap-to-assign quietly disarms if you tap an incompatible slot (no shake/feedback). Try it on a phone; feedback polish available if wanted.
- C4: "Mult. regression" short name (the approved table's "Multiple regression" was over the length limit) - alternative "Multi regression" reads more in-register.

## Acceptance

`npm run build && npm run preview` - walk desktop AND a phone-sized window (or real device), both themes, Reduce Motion on/off.
Specifically exercise: the hint bar (appears once, dies on your first rail jump), the switcher pills between two tests, tap-to-assign on mobile, the welcome entrance, and a stage completion.
NEVER pushed or deployed without your word.
