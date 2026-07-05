# Polish, onboarding & mobile (slice 3) - design spec

Date: 2026-07-05
Owner: Benjie (rulings from the slice-3 decision boards, artifact e5feeba5, all picked by him)
Status: approved design, pending spec review
Predecessors: slice 1 (grouped pool) + slice 2 (visual redesign), both accepted; post-acceptance defect fixes `418b537` (sticky rail) and `027aa39` (per-card run narration, which also delivered O11).

## Goal

Finish what the redesign started: make the journey self-disclosing, give test-switching finger-sized targets, add the approved motion register, and make the phone experience acceptance-grade.

## Owner rulings (locked)

- R1 (his F1 = option B): an on-screen test switcher on every test-config screen - a pill row under the title ("&#10003; 1 · t-test | 2 · One-way ANOVA | 3 · Kruskal-Wallis"): done tests carry a clay check, the current test is the ink pill, targets are finger-sized.
  The rail's sub-dots remain as pure progress indicators on desktop and disappear on phones (the switcher replaces them there).
- R2 (his F2 = option 2a): a one-time hint bar under the rail ("Tip: the journey bar is clickable - jump back to any finished stage, or between your tests, anytime."), dismissed by its close button or automatically after the user's first rail jump, remembered per session.
  Plus stronger self-disclosing affordances: hover lift and label underline on enabled stages (2c is an AND, not the mechanism).
- R3 (his F3, seen live and approved): the motion register -
  (a) Welcome entrance: eyebrow, wordmark, curve draws itself, observations settle one by one staggered, prose, then CTA; about 2 seconds, ease-out, plays once per visit;
  (b) stage-completion moment: check pops in (one bounce-free overshoot), the rail fill surges to the next stage with a small settle, halo lands on the new current stage;
  (c) 150ms screen cross-fades and chips settling into slots with a soft scale-in (the deferred O1);
  all disabled under prefers-reduced-motion.
- R4 (his F4): the mobile fixes list -
  compact rail redesigned to ONE line (nodes + current label + inline fraction; no dead band, no floating fraction);
  every interactive control gets a minimum 24px hit area (44pt-equivalent for primary controls);
  the Configure-data columns table gets its own horizontal scroll container (the "Use" column is currently cut off);
  a touch-viewport Playwright test covers the drag flow, and if real-device drag disappoints, a tap-to-assign fallback (tap chip, tap slot) ships behind the same interaction.
- R5 (O5): the dead config-screen RunModule instance is removed (runs navigate to Results immediately; that stays).
- R6 (O9): populate `CATALOG.short` for all 48 tests so switcher pills and any sub-dot labels stay compact.

## Design

### 1. Test switcher (R1)

A presentational `TestSwitcher` row rendered by `TestConfigScreen` under the title, listing the selected tests in selection order.
Pill states: done (configured; clay check prefix), current (ink pill), todo (hairline pill).
Clicking navigates via the existing `goTo` gates; disabled pills are real disabled buttons (same rules as rail sub-dots).
Numbering matches the results cards (selection order).
On viewports under 560px the rail hides its sub-dots entirely; the switcher is the one test-switching surface.

### 2. Onboarding hint (R2)

A dismissible `.hintbar` under the rail, rendered on the first screen after Welcome, once per session (sessionStorage flag; no persistence beyond the tab, deliberately - returning users in a new session may need it again).
Dismiss on the close button or on the first click of any rail stage or sub-dot.
Copy lives in copy.ts.
Affordances: enabled stage labels get an underline on hover/focus; nodes lift 1px; transitions ride the existing `--motion` token.

### 3. Motion register (R3)

CSS-only where possible; the welcome entrance uses animation-delay staggering exactly as the approved live demo (fadeUp / dotIn / drawPath keyframes).
"Plays once per visit": the animation runs on mount of Welcome; no replay persistence gymnastics.
Stage completion: keyframes on the `.done` node's check (`checkPop`) and a fill transition that overshoots ~2% and settles (`fillPulse`), triggered by the state change re-render (CSS animation on class change; no JS timers).
Screen cross-fade: a 150ms opacity fade on the `.screen > section` mount (a small `FadeIn` wrapper or CSS animation on section mount in App).
Chip settle: `chipIn` scale(0.9→1)/opacity keyframe on `.chip.assigned` when it appears inside a slot.
All of it dies under the existing `prefers-reduced-motion` kill switch (already global).

### 4. Mobile (R4)

Compact rail (under 560px): one line - done/current/todo nodes at 24px, the current stage's label inline to the right of its node, mono fraction at the far right; sub-dots hidden (R1 owns switching); sublabel counter hidden (the switcher shows it).
Hit areas: sub-dots (desktop) get an invisible 24px hit padding; chips keep their size but gain padding; the theme select and pill controls audit to 24px+.
`ConfigureDataScreen`'s `.cols-table` wraps in an `overflow-x:auto` container (house rule: the page body never side-scrolls).
New Playwright project entry (or test file) with a mobile viewport (390x844, touch) covering: upload -> configure -> pick -> drag score to outcome (touch) -> run gate enabled.
If the touch-drag e2e proves flaky/unworkable, tap-to-assign fallback: tapping a compatible chip arms it (accent outline), tapping an open slot assigns; tapping elsewhere disarms; pointer-only addition in DragSlotsUI, no store changes.

### 5. Removal (R5)

Delete the `running && <RunModule .../>` block from TestConfigScreen (unreachable) and its import if now unused.

### 6. Short names (R6)

Fill `short` for all CATALOG entries (e.g. "One-way ANOVA + post-hoc" -> "One-way ANOVA", "Instrumental variables (IV / 2SLS)" -> "IV / 2SLS").
Owner reviews the full list in the plan before build; the registry consistency tests pin names, not shorts, so this is additive.

## Out of scope

Stats, engine, exports, print, APA structure; SEM canvas (owner WIP pending O7); figure series colors (O3, its own slice); doc screenshot regen (O8, after this slice lands); popover test picker (F1 option A - future nicety).

## Testing

- Unit: TestSwitcher states/order/gating; hint bar render-once + dismiss paths; compact-rail model unchanged (CSS-level change); chip/cross-fade animations are CSS-only (no unit tests; reduced-motion grep audit extends the existing audit doc).
- e2e: existing 19 stay green; plus the new mobile-viewport journey.
- Gate: test:fast, build, full e2e, fresh-clone, and an updated contrast/motion audit note.
- Acceptance: owner click-through on desktop AND a phone-sized window (or real device), both themes.

## Verification

Success: a first-time user discovers the rail is navigation without being told twice; switching tests while configuring takes one obvious tap on any device; finishing a stage feels rewarded; the welcome page makes people want to screenshot it; and the phone experience is the same design, not a degraded echo.
