# Telos — Association Family Slice (Design)

**Date:** 2026-06-12
**Status:** Written for Benjie's spec review. Scope and the two design forks were ruled in the
brainstorm session (custom expected proportions now; grouped-bar figure + bundle-line amendment);
structure ruling = Approach A (thin backbone, then parallel per-test worktrees).
**Process:** the lighter regimen ruled 2026-06-12 (`docs/superpowers/ROADMAP.md`): keep the
statistical spike, card-scoped consistency tests + mutation checks, full gates every commit, and
the end click-through; drop the full-plan sandbox replay (spot-validate novel machinery only),
per-task reviews for pattern-following tasks (one combined slice-end review instead), and
multi-agent plan authoring. Parallel per-test worktrees + serial integration per Benjie's ruling.

## 1. Scope — Benjie's rulings (2026-06-12)

Six tests into the finished shell, family **3 · Association**. All six cards are already drawn in
both companion spec HTMLs — no new card authoring this slice.

| # | Test | Catalog id | Roles (arity) | Options drawn |
|---|------|-----------|----------------|----------------|
| 1 | Pearson correlation | `pearson` | Variable A (1), Variable B (1) — interval/ratio | α · tails · CI |
| 2 | Spearman correlation | `spearman` | Variable A (1), Variable B (1) — ordinal/interval/ratio | α · tails |
| 3 | Kendall's tau | `kendalls-tau` | Variable A (1), Variable B (1) — ordinal/interval/ratio | α · tails |
| 4 | Chi-square goodness-of-fit | `chi-square-goodness-of-fit` | Variable (1) — nominal/ordinal | expected proportions · α |
| 5 | Chi-square independence | `chi-square-independence` | Row variable (1), Column variable (1) — nominal/ordinal | α · continuity correction |
| 6 | Fisher's exact | `fishers-exact` | Row variable (1), Column variable (1) — nominal/ordinal | α · tails |

**Structure ruling: Approach A — thin backbone, then 6 parallel worktrees.** Unlike ANOVA there
are no shared stats modules: each test is a self-contained R call. The backbone exists only
because the goodness-of-fit custom-proportions UI touches shared files (`types.ts`,
TestConfigScreen) and must be frozen on main before the worktrees fan out (the rule that made the
ANOVA merge clean: implementers touch only their own new files).

**Fork rulings (AskUserQuestion, 2026-06-12):**

- **R1 — custom expected proportions ship now.** The GoF card's guide promises "set the
  proportions yourself"; the rendered app honors it this slice (render-faithfully rule).
- **R2 — χ² independence + Fisher ship a grouped bar** (consistent with the live Frequencies &
  cross-tabs figure, pure ggplot2, no new package risk). The two outputs cards' bundle lines are
  amended `figure_mosaic.png` → `figure_bar.png`; the drawn figure type "mosaic / grouped bar
  chart" already covers it. **Same-spirit truth fix flagged for audit:** the two cards' R-map
  figure entry `ggplot2/vcd::mosaic() → figure` becomes `ggplot2::geom_bar() → figure` so the
  user-facing R map names what actually runs. Benjie's spec review covers both edits.

## 2. Backbone (serial phase on main, frozen before worktrees fan out)

- **B1 — `proportions` option kind** (the slice's one novel machinery → spot-validated per the
  regimen). New member of `OptionSpec.kind` + TestConfigScreen rendering:
  - The GoF options strip draws **expected proportions** as a select: `equal` (default) /
    `custom`.
  - On `custom`, once the Variable slot is filled, one number input per category of the dropped
    column appears (labels = the column's categories, sorted as the frequencies table sorts —
    alphabetical, the tabyl convention). Defaults = equal split.
  - Validation: every proportion > 0 and the sum within 0.001 of 1; otherwise the run gate
    blocks with a named-gate hint (existing gate-hint pattern). Changing the assigned Variable
    resets the inputs to equal split for the new categories.
  - While `equal` is selected no inputs render — the drawn card is the visual baseline.
- **B2 — spec amendment** (the R2 edits above) committed before any consistency test transcribes
  those cards, so registries assert against the amended truth.
- **B3 — engine preload check.** Expected: **no new VFS packages.** `effectsize` (Cohen's w) and
  `rstatix`/`car` already ship; `rcompanion` (Cramér's V) is the only new name on a card R map —
  the spike decides whether it ships or V is hand-rolled (section 4, decision rule D1). If a new
  package ships, `scripts/copy-webr.mjs` preload + decompressed-VFS rules apply, with the
  established < 25 MiB-per-file size gate.

## 3. Per-test work and recorded conventions

**Per-test shape (all 6, the established pattern):** registry entry transcribed byte-faithful
from its card + consistency test against the live spec HTML + mutation check; stats module
(R call via the shared engine, spike-verified known answers); builder; unit tests. Worktree
implementers touch only their own files + fixtures; catalog flip and RUNNERS/BUILDERS
registration happen in the serial integration task.

**Recorded conventions (delegated; Benjie audits here and in the rendered app):**

1. **Pair label** in the three correlation tables' Pair column: `<Variable A> – <Variable B>`
   (en dash), variables in slot order.
2. **Deterministic p-paths for the rank correlations:** `cor.test(..., exact = FALSE)` for both
   Spearman and Kendall. Reasons: the Kendall card draws a **z** column (only the asymptotic
   path returns z; the exact path returns T), and the Spearman exact path is unavailable with
   ties anyway (R falls back with a warning). Matches the Wilcoxon precedent (asymptotic via
   explicit flag, continuity behavior left at R defaults). Spike verifies WebR ≡ native R on
   tied and untied fixtures.
3. **tails option** maps to `alternative` (two → `two.sided`, etc.) for the three correlations.
   For Fisher, `alternative` only affects 2×2 tables in R — larger tables are inherently
   two-sided; the result card notes this only when a non-2×2 table runs with tails ≠ two
   (check-note pattern). GoF has no tails option (χ² is one-sided by construction), as drawn.
4. **Continuity correction** (independence): drawn "on (2×2)" → default on, `correct = FALSE`
   when toggled off; R ignores it for non-2×2 — no note needed (the card footnote already
   teaches this).
5. **GoF with custom proportions:** `chisq.test(x, p = props)`; standardized residuals from
   `$stdres`; **Cohen's w computed against the same specified proportions** (the equal-props w
   and custom-props w differ — spike verifies both). df = k−1 as the card footnote draws.
6. **Cramér's V:** `rcompanion::cramerV` at defaults is the authority (it is what the card's
   R map names); the hand formula V = √(χ²/(N·min(r−1, c−1))) is the fallback (D1). Whether
   rcompanion uses the Yates-corrected or uncorrected χ² is **pinned by the spike** in native R
   (not assumed here), and the fallback reproduces whichever convention rcompanion uses, so the
   shipped V is identical down either ladder branch.
7. **Contingency table rendering** (independence): cells `observed [expected]` with row/column
   percentages per the card footnote; columns expand r×c with a Total row/column as drawn.
   Small-expected-counts warning (any expected < 5) renders the card's own suggestion of
   Fisher's exact as a check-note. Fisher's contingency table is observed-only, as drawn.
8. **Fisher non-2×2:** exact p only; OR and 95% CI cells render an em-dash, with the card
   footnote carrying the explanation (it already does). `fisher.test` at defaults; the spike
   checks a 3×3 fixture for workspace adequacy.
9. **Figures:** Pearson = scatter + `geom_smooth(method = "lm")`; Spearman/Kendall = scatter of
   raw values (the cards say "optionally on ranks" — raw is the simpler reading and the spike
   exemplar); GoF = observed-vs-expected dodged bar; independence/Fisher = grouped (dodged) bar,
   Frequencies & cross-tabs styling. All ggplot2, house palette.
10. **Min rules (existing kinds, no new gate machinery):** correlations = `complete-pairs`
    n ≥ 3; GoF = assigned Variable has ≥ 2 categories (`categories.min` from the ANOVA
    backbone); independence/Fisher = both variables ≥ 2 categories among complete rows.
11. **Missing data:** listwise per test, own N reported — Benjie's standing R2 ruling.

## 4. Pre-committed decision rules (spike-gated, no design reopening)

- **D1 — Cramér's V source ladder:** `rcompanion` loads under WebR and matches native R → ship
  it; otherwise hand-roll V (formula in convention 6) with the same known-answer targets —
  pre-verified work either way, PMCMRplus precedent. The card's R map only changes if the
  fallback fires (one-line amendment, flagged to Benjie at slice end).
- **D2 — Cohen's w source:** `effectsize::cohens_w` already ships; spike confirms it accepts
  specified proportions. Fallback: w = √(χ²/N), hand formula, same targets.

## 5. Testing, verification, sequencing

- **Spike (first, gates the plan):** WebR ≡ native R 4.6.0 cross-check on fixed fixtures for all
  six tests' headline numbers — r/t/df/p/CI (and CI level variations), ρ/S/p and τ/z/p on tied
  **and** untied data, GoF χ²/df/p/stdres/w under equal **and** custom proportions,
  independence χ²/df/p/V with correction on **and** off, Fisher 2×2 p/OR/CI both tails +
  3×3 exact p — plus the D1/D2 ladders. Ground truth committed under
  `docs/superpowers/reviews/`. Spike verdict reported to Benjie with the plan (the ladders mean
  no verdict blocks; only an unforeseen failure would).
- **Consistency + mutation:** every registry entry consistency-tested against the live
  (amended) spec HTML, each proven discriminating by mutation — the established gate.
- **Spot-validation (novel machinery only):** the `proportions` option kind — a focused sandbox
  check of the dynamic inputs (appear on drop, reset on reassignment, sum gate blocks the run,
  values reach R) rather than a full-plan replay.
- **e2e — one new journey, existing journeys byte-untouched:** all six tests in one session on
  an association fixture (two numeric + two categorical columns, small enough that Fisher is
  sensible), asserting: custom-proportions inputs flow (set a non-equal split, result reflects
  it), the r×c contingency renders, and the zip unzips with NN-foldered card-faithful filenames
  (`figure_bar.png` per R2, via `FigureSpec.file`).
- **Combined slice-end review:** one opus review of the whole diff (replaces per-task reviews),
  with independent native-R recomputation of each test's headline numbers.
- **Sequencing:** spec amendment (B2) → spike (→ report with plan) → plan (single author +
  self-review) → backbone B1/B3 serial on main → 6 parallel worktrees → serial integration +
  full gates (tsc · full vitest · build · e2e) → combined review → README/ROADMAP update →
  **Benjie's click-through gate. Nothing pushed or deployed without his call.**

## 6. Out of scope

Correlation matrices / more than one pair per run (cards draw exactly 1+1). Partial correlation,
point-biserial as a separate card. Mosaic figures (R2). McNemar / Cochran's Q (not in the
catalog family). Expected-proportion presets beyond equal/custom. Long-format reshaping. Export
formats beyond the established zip.
