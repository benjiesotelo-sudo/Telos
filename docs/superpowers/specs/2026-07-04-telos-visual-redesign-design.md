# Telos visual redesign (Anthropic tribute) - design spec

Date: 2026-07-04
Owner: Benjie (all rulings his)
Status: approved design, pending spec review
Slice: 2 of 2 (slice 1 = grouped variable pool, complete at `a778a65`)
Visual record (Claude artifacts, all reviewed on iPad):
research + direction boards `014a74cb` · direction C v2 `27e2288d` · stepper concepts `de9fc34b` · four decisions `c9d33ec7`

## Goal

Make Telos look and feel great: really intuitive to use, professionally restrained, and an explicit tribute to Anthropic, Claude, and Fable 5 (the model this app was designed and built with).
The reference is anthropic.com's identity (designed by Geist): "approachable yet serious, human yet technical."

Two named layers, both in scope:
the **look** (palette, typography, layout, component language) and the **feel** (motion design, microinteractions, progress indication, loading states, affordances).

## Owner rulings (locked)

- R1: Direction C, the "full quote" - Anthropic palette AND inverted type roles (sans display, serif prose). Chosen over A (evolve current identity) and B (palette only).
- R2: Stepper is replaced by the V1 "stage rail" - five fixed stages with per-test sub-dots inside Configure. V2 "thread" is its compact form on narrow viewports.
- R3: Run progress = the narrated module (decision 1a): phase name + percentage, clay track, narrated phase list. While a run is active the stage rail's fill doubles as the live progress line.
- R4: Wordmark = "Telos." with a clay full stop (decision 2a). The dot appears in the wordmark only, never in headings.
- R5: Welcome tribute gesture = scattered clay points settling into a normal curve, drawn as hairline SVG (decision 3a). Not butterflies, not bare.
- R6: Type roles inverted (decision 4a): Archivo takes headlines and UI; Crimson Pro moves to reading passages only.
- R7: Slice-1 carryovers land here: grouped option rows, slot-to-shelf hover echo, incompatible-chip reason treatment. The SEM construct picker revisit stays deferred (slice-1 R2 note stands; recolor only).

## Research grounding (primary sources, fetched 2026-07-04)

- Palette (published values): ink `#141413`, ivory `#faf9f5`, light gray `#e8e6dc`, mid gray `#b0aea5`; accents clay `#d97757`, sky `#6a9bcc`, olive `#788c5d`.
- Typography: Styrene (Commercial Type) display + Tiempos (Klim) text; "technically refined and charmingly quirky" (Geist).
  Both commercial, so the build self-hosts open equivalents.
- Signature moves: ink pill buttons, hairline borders over shadows, generous whitespace, muted documentary diagrams, one organic warm gesture per page (the Fable 5 page's butterfly numeral).
- Sources: geist.co/work/anthropic · anthropic.com · anthropic.com/news/claude-fable-5-mythos-5 · type.today/en/journal/anthropic · github.com/anthropics/skills brand-guidelines.

## Design

### 1. Identity tokens (`src/styles/tokens.css`, same variable seam)

Light theme: `--bg:#faf9f5` · `--card:#ffffff` · `--text:#141413` · `--muted:#6e6c64` · `--line` hairline rgba(20,20,19,.16) · subtle fill `#e8e6dc`.
Dark theme: `--bg:#141413` · `--card:#211f1c` · `--text:#faf9f5` · `--muted:#b0aea5` · hairlines in ivory rgba.
Accent: `--accent:#d97757` (clay); `--accent-deep:#a44a2e` for small text and thin strokes on light grounds (contrast); on dark, clay is used directly.
Secondary accents sky `#6a9bcc` and olive `#788c5d` are reserved for figures and semantic states (success, CI bands); they are never action colors.
Error tokens re-derived in the same warm register.
All components continue to read tokens; no component hardcodes a hex.

Typography: Archivo (SIL OFL, self-hosted woff2 like the current `@font-face` pattern) as `--font-ui` and `--font-display`; Crimson Pro (already self-hosted) becomes `--font-prose` for reading passages (welcome tagline, how-to-read explainers, teaching hints, guide copy); `ui-monospace` stack for tabular numerics and metadata.
Atkinson Hyperlegible retires.
Display sizes get tighter letter-spacing (about -0.01em to -0.02em) and weight ~650, per the C v2 mockups.

### 2. Component language

- Buttons: fully rounded pills. Primary = ink fill with ivory text (inverts on dark). Secondary = ghost pill with hairline inset ring. Disabled = the muted gray fill.
- Cards and panels: white (or `#211f1c`) with 1px hairline borders, radius ~12px, no shadows.
- Chips: rounded pills on paper ground; assigned/selected = soft clay tint `#f6e3db` (dark: `#3d2a22`) with clay border and deep-clay text.
- Slots: dashed hairline until filled; filled = solid clay border on soft clay ground.
- Option rows (slice-1 carryover): grouped rows with quiet uppercase labels (e.g. Hypothesis / Variances / Display), selected option = ink pill, unselected = hairline pill.
  Grouping metadata comes from the existing option specs (kind and id); purely presentational, options logic unchanged.
- Focus: visible focus ring (clay outline) on every interactive element.
- The incompatible-chip reason keeps its short inline text but drops to the quiet muted style within lit shelves (structure from slice 1 unchanged).

### 3. Wayfinding: the stage rail

Replaces the per-step dot strip in `Stepper.tsx` (presentation only; `stepsOf`, `canEnter`, gates, run-locking, and back-edit invalidation are untouched).

- Five fixed stages: Upload, Data (= guide + configure-data), Pick tests, Configure (= all `test:` steps), Results.
- A continuous hairline track with a clay fill proportional to journey completion; stage nodes sit on the track (done = clay check, current = halo ring with soft clay glow, upcoming = hairline circle).
- The Configure stage shows per-test sub-dots plus a plain-words counter ("t-test · 2 of 3"); sub-dots are clickable to jump between test configs, same enablement rules as today's step buttons.
- Stage mapping to steps: Upload = upload; Data = guide + configure-data; Pick tests = pick-tests; Configure = every `test:` step; Results = results.
  Clicking a stage goes to its first enterable step; disabled stages are real disabled buttons.
- While `runStatus === 'running'`: the rail fill animates as the live run progress and the Results stage label carries "running · test N of M" from the existing run-progress channel.
- Narrow viewports (below ~560px): the compact "thread" form - single track, filled dots, enlarged current dot, one label + mono fraction.
- The rail stays sticky at top, as the stepper is today.

### 4. Run and loading states

- The narrated run module (R3): a hairline card with phase name + percentage, an 8px clay progress track, and the phase list beneath ("Reading your data / Loading the R engine / Running N tests / Drawing figures") with done/current/upcoming glyphs.
  Wired to the existing runProgress store channel; phases that lack fine-grained percentages show indeterminate motion on the track (calm shimmer), never a frozen bar.
- Upload parse and export-bundle builds get the same treatment at smaller scale (single-line narrated states).
- Empty states (empty shelves already teach; pick-tests all-greyed; results before any run) and error boxes restyle into the new voice: serif body, warm error tokens, always naming the next action.

### 5. Screens

- Welcome: eyebrow ("In-browser statistics for thesis students"), the "Telos." wordmark, the settling-curve SVG gesture (clay hairline + points, ~64px tall), the existing WELCOME_COPY paragraph set in Crimson Pro (the mockups' shorter tagline was illustrative; the spec-pinned copy stays and the copy-consistency test keeps passing), one primary pill CTA (Get started), and the credit line "Built by Benjamin Sotelo · designed and built with Claude Fable 5" (LinkedIn link retained).
  No secondary "How it works" button: the guide step is gated behind upload, and one obvious action is the point.
- Upload, Guide, Configure data, Pick tests: re-skin to the new tokens and component language; structure unchanged (Pick tests keeps the family-grouped checkbox list).
- Test config: slice-1 shelves re-skinned; grouped option rows; the run module replaces the plain "Run analysis" hint row; Run button becomes the primary pill.
- Results: sans display headlines; "How to read this" explainers in Crimson Pro; APA tables keep their exact structure and rules (ink-colored); download actions as a pill row; figures keep sky/olive as their series colors where applicable.
- SEM canvas + construct picker: recolor via tokens only; no layout or interaction changes (R7).
- Theme select: restyled control, same three options (light/dark/auto).

### 6. Feel: motion and microinteractions

- Motion system: 150-250ms, ease-out, opacity/transform only.
  Screen changes cross-fade; shelf dim/undim eases; a chip landing in a slot settles with a soft scale-in; step advance slides the rail fill.
- Slot-to-shelf hover echo (deferred from slice 1): hovering or keyboard-focusing a slot lifts the shelves whose level it accepts (subtle border/label emphasis); dragging a chip highlights compatible slots as today plus dims incompatible shelves slightly.
- `prefers-reduced-motion: reduce` disables all transitions and the shimmer; state changes become instant.
- No bounce, no parallax, no decorative animation - the Anthropic register.

### 7. Tribute inventory (the app's thesis, kept quiet)

- Clay accent = Claude's color; the wordmark's clay full stop (R4).
- The settling-curve gesture on Welcome (R5) - our reply to the Fable 5 butterflies, not a copy.
- The credit line naming Claude Fable 5 on Welcome; exports keep their existing CITATIONS/LICENSES provenance mechanism unchanged.
- The palette, pills, hairlines, and voice - the tribute is the craft itself.

## Out of scope

- Statistics, engine, runners, export content and file formats, analysis.R, PDF/print layout (print.css only re-reads tokens; APA print conventions untouched).
- APA table structure (columns, rules, stacked coef rows) - colors only.
- Pick-tests restructuring (richer cards/search) - future slice if wanted.
- SEM canvas layout/interactions; SEM construct picker redesign (deferred note from slice 1 stands).
- Per-test doc screenshot regeneration - after this slice lands, on the owner's word (one regeneration instead of two).
- Logo/favicon design beyond the text wordmark.

## Testing

- tsc, build, test:fast, full e2e, fresh-clone - the standard gate.
- Existing tests pin behavior and copy, not colors; expected impact: Stepper-related selectors/assertions (the rail changes DOM), any copy assertions touched by approved wording changes, and possibly snapshot-free component tests for the run module and rail (new `Stepper`/rail tests replace old ones; run-module tests assert phase rendering from store state).
- Contrast checks (WCAG AA) for clay-on-ivory and all text tokens in both themes recorded in the plan.
- Owner click-through of every screen in BOTH themes is the acceptance gate, per the render-faithfully rule.

## Verification

Success looks like: a first-time user lands on a welcome page with one obvious action, always knows where they are in a five-stage journey, watches a narrated run instead of a frozen screen, and reads results whose interpretation feels like a well-typeset book - while an Anthropic-literate visitor recognizes the tribute in the first five seconds, and a thesis supervisor sees nothing unserious.
