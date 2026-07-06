# Responsive resilience (slice 4) - design spec

Date: 2026-07-06
Owner: Benjie
Status: approved direction ("the goal is a very adaptive format - responsive design"), pending spec review
Predecessors: slices 1-3 pushed at `0c7fb29`.

## Goal

The app renders and operates correctly on ANY viewport from 320px up and with ANY input (mouse, touch, keyboard) - and stays that way, because appearance itself becomes a tested contract.
Not device buckets: one fluid design that adapts continuously, with touch behavior keyed to the input device rather than the screen width.

## Owner rulings (locked)

- R1: Responsive audit + repair. Every screen is exercised at 320 / 390 / 560 / 680 / 834 / 1024 / 1280 px widths; anything that horizontally overflows the page (house rule: the body never side-scrolls), clips content, or collapses illegibly gets fixed. The fluid 760px-column base and existing breakpoints (560 rail, ~680 grids) stay; new rules are added only where the audit shows real breakage.
- R2: Capability queries. Input-dependent affordances follow the INPUT, not the width: hover-only cues (slot-to-shelf echo, rail hover underline/lift) get `@media (hover: hover)` gating so touch devices are not promised hover they cannot perform; touch-first cues (tap-to-assign) work at every width - an iPad is wide AND touch and must get the touch affordances.
- R3: Visual-regression baselines. Playwright `toHaveScreenshot` locks the accepted design for the five deterministic screens (Welcome, Guide, Configure data, Pick tests, Test config with an assignment) at three viewports (1280 desktop, 834 tablet, 390 phone) x both themes = 30 baselines. From then on "it looks wrong" is a red test.
  Determinism rules: contexts emulate `reducedMotion: 'reduce'` (kills the entrance/motion register for stable pixels) and a fixed theme via the app's own selector; small `maxDiffPixels` tolerance for antialiasing.
  Results screens are excluded (WebR figure rendering is not pixel-deterministic) - recorded limitation.
  Baseline update workflow: an intentional design change re-runs with `--update-snapshots` and the OWNER approves the visual diffs at his gate; baselines are committed assets.
- R4: The sticky-rail assertion the last catch exposed: an e2e scrolls a tall screen and asserts the rail stays in view.
- R5: A tablet Playwright project (834x1112, touch) joins desktop + mobile permanently and runs the touch journey.

## Out of scope

Stats, engine, exports, print; any layout REDESIGN beyond what the R1 audit shows as broken; results-screen baselines (above); CI runners (baselines are generated and compared on the owner's machine - single-dev project, recorded caveat).
Baselines pin the reduced-motion resting frame: an animation whose `fill-mode` leaves the wrong end state under `prefers-reduced-motion: reduce` would only show up as a bug on the animated path, which is outside baseline coverage (recorded limitation, not fixed by this slice).

## Testing

The slice IS testing, mostly: gate = fast suite, build, full Playwright (desktop + mobile + tablet + the new visual project), fresh clone (which now also proves committed baselines match a clean build).
Owner acceptance: click-through resized freely from narrow to wide (the "weird dimensions" test), plus iPad if available.

## Verification

Success: drag any edge of the browser window from 320px to full-screen and every screen reflows without a single horizontal scrollbar or clipped control; an iPad gets touch affordances despite its width; and any future change that alters how an approved screen LOOKS turns a test red before Benjie ever sees it.
