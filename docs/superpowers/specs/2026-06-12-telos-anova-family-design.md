# Telos — ANOVA Family Slice (Design)

**Date:** 2026-06-12
**Status:** Approved section-by-section by Benjie in the brainstorm session (scope, Mixed ANOVA
card, backbone, conventions + problem fixes, testing/sequencing). This document is the written
record for his spec review.
**Process:** the lighter regimen ruled 2026-06-12 (see `docs/superpowers/ROADMAP.md`): keep the
statistical spike, card-scoped consistency tests + mutation checks, full gates every commit, and
the end click-through; drop the full-plan sandbox replay (spot-validate novel machinery only),
per-task reviews for pattern-following tasks (one combined slice-end review instead), and
multi-agent plan authoring. Parallel per-test worktrees + serial integration per Benjie's ruling.

## 1. Scope — Benjie's rulings (2026-06-12)

Eleven tests into the finished shell:

| # | Test | Card status |
|---|------|-------------|
| 1 | One-way ANOVA + post-hoc | drawn (inputs ~line 426, outputs spec) |
| 2 | Factorial ANOVA | drawn |
| 3 | Repeated-measures ANOVA | drawn |
| 4 | **Mixed ANOVA** | **NEW — authored this slice (section 2), Benjie ruled: 1 between × 1 within** |
| 5 | Nested ANOVA | drawn |
| 6 | Welch's ANOVA | drawn |
| 7 | ANCOVA | drawn |
| 8 | MANOVA | drawn |
| 9 | MANCOVA | drawn |
| 10 | Kruskal-Wallis | drawn |
| 11 | Friedman | drawn |

**Roadmap correction (part of this slice):** `ROADMAP.md` listed "mixed" as if already in the
specs and omitted Welch's. The specs contain no Mixed ANOVA card; Welch's ANOVA is drawn. Benjie
ruled: add Mixed ANOVA to the specs first (it was part of the vision), making this an 11-test
slice. Fix the ROADMAP line accordingly.

**Structure ruling: Approach A — serial backbone, then parallel per-test.** Shared modules are
built and frozen on main first; the 11 test implementers then run in isolated worktrees touching
only their own files; one serial integration task registers everything; one combined slice-end
review. Rationale: the family shares heavy machinery (six tests draw the same post-hoc table,
three share sphericity, four share adjusted means) — duplicating it per-test (rejected
Approach B) multiplies the review surface and risks inconsistent p-adjustment across tests;
fully sequential (rejected Approach C) ignores the parallelization ruling for a family this
internally similar.

**Conventions ruling:** Benjie delegated the open statistical conventions to my judgment as
recorded decisions (section 4), flagged here for his audit and reviewable in the rendered app.

## 2. New spec content — the Mixed ANOVA card

Authored into **both** companion spec HTMLs (`telos_test_inputs.html`,
`telos_test_outputs.html`), placed directly after Repeated-measures ANOVA in family
2 · Group comparisons. The ui_spec step-5 picker tree gains the entry, and every "46 tests"
count across the three files becomes 47 (the sweep is consistency-tested). Benjie reviews the
rendered card in the app like every other card.

### Inputs card

- Title: **Mixed ANOVA** · subtitle: *does change over time differ between groups?*
- Palette (wide format): `participant_id` (id), `group` (nominal), `score_t1` / `score_t2` /
  `score_t3` (ratio). Greyed example: `satisfaction` — "ordinal, repeated measure needs
  interval/ratio".
- Slots:
  - **Subject ID** — any level · exactly 1 (e.g. participant_id)
  - **Between-groups factor** — nominal/ordinal · exactly 1 (e.g. group — treatment vs control)
  - **Repeated measures** — interval/ratio · 2 or more (one column per timepoint, in time order)
- Options strip (identical to RM-ANOVA): α 0.05 · sphericity **GG correction** (GG / HF / none)
  · post-hoc **on**
- Configure guide: use when the same people are measured under 2+ conditions or timepoints
  **and** belong to different groups. The headline question is the **interaction** — did the
  groups change differently over time? Data must be wide format, one row per person.
- Meta tags — tables: descriptives, mixed ANOVA, sphericity, post-hoc · figure: profile plot by
  group · checks after run: sphericity, Levene's.

### Outputs card

- **Table 1.** Descriptives by group × condition — Group, Condition, N, M, SD
- **Table 2.** Mixed ANOVA — Source, SS, df, MS, F, p, partial η²; rows: Group (between),
  Condition (within), Group × Condition. Note: between and within effects are tested against
  different error terms.
- **Table 3.** Sphericity (Mauchly's test) — Effect, W, p, GG ε, HF ε; on the within and
  interaction terms; same rule as RM-ANOVA: omitted when the repeated factor has only 2 levels.
- **Table 4.** Post-hoc comparisons (condition pairs) — Pair, M<sub>diff</sub>, SE,
  p<sub>adj</sub>, 95% CI
- **Figure.** Profile plot — one line per group, means ± CI across conditions.
- How to read: interaction first — a significant Group × Condition means the groups changed
  differently; only then read the main effects. Includes (problem fix 6): *"When the group ×
  condition interaction is significant, these overall condition comparisons can mislead — read
  each group's line on the profile plot instead."*
- APA template: "A mixed ANOVA found a significant group × time interaction, *F*(__,__)=__,
  *p*=__, partial η²=__."
- R map: `afex::aov_ez` → Tables 2–3 · `emmeans` → Table 4 · `ggplot2` → profile plot
- Bundle: `table_descriptives.png · table_mixed-anova.png · table_sphericity.png ·
  table_posthoc.png · figure_profile.png`

## 3. Backbone modules (serial phase on main, frozen before worktrees fan out)

Each ships with unit tests + known-answer checks; the full suite and both existing e2e journeys
stay green after every backbone commit.

- **B1 — Engine preload extension.** New packages per the spec's own R-map lines: `afex`
  (factorial/RM/mixed incl. sphericity), `emmeans` (post-hoc, adjusted means), a Dunn source and
  a Nemenyi source (priority ladder, section 5 fix 3). Preload list + VFS images update in
  `scripts/copy-webr.mjs`, decompressed at copy time (established double-gunzip rule).
- **B2 — Shared post-hoc module** (`src/lib/stats/posthoc.ts` + R helper). One result shape
  `{pair, mDiff, se, pAdj, ciLow, ciHigh}` powering the identical Pair / M<sub>diff</sub> / SE /
  p<sub>adj</sub> / 95% CI table drawn by six cards (one-way, Welch, factorial, RM, mixed,
  ANCOVA), parameterized by procedure: Tukey HSD, Bonferroni, Scheffé, Games-Howell,
  emmeans-adjusted pairwise. The rank-based post-hoc tables differ in shape (Dunn: Pair, Z,
  p<sub>adj</sub> · Nemenyi: Pair, p<sub>adj</sub>) and live in their own tests' stats modules —
  they share only the p-adjustment vocabulary, not the table shape.
- **B3 — Sphericity module** (`src/lib/stats/sphericity.ts`). Mauchly W/p, GG and HF ε, the
  corrected-df application rule, and the 2-level omission rule. Used by RM and Mixed only; the
  most treacherous computation in the slice — single implementation, spike-verified, adversarial
  verification per the regimen.
- **B4 — Adjusted-means module.** Estimated marginal means (Group, Adj. M, SE, 95% CI) via
  `emmeans`; used by ANCOVA and MANCOVA.
- **B5 — Chassis/eligibility extension.** New eligibility rule kind: **category count ≥ 3** on a
  factor (one-way ANOVA, Kruskal-Wallis). Plus the nested/crossed detection check (section 5
  fix 4). Anything else the spike reveals lands here, not in per-test code.
- **Dev-loop script (fix 5):** `npm run test:fast` — everything except the WebR engine suites —
  joins the existing full `npm test` (serialized, the commit gate).

## 4. Per-test work and recorded conventions

**Per-test shape (all 11, the core-slice pattern):** registry entry transcribed byte-faithful
from its card + consistency test against the live spec HTML + mutation check; stats module
(R call via the shared engine + TS types, spike-verified known answers); builder (tables /
figures / APA from registry + stats); unit tests. Worktree implementers touch only their own
four files + fixtures; catalog registration happens in the serial integration task.

**Recorded conventions (delegated; Benjie audits here and in the rendered app):**

1. **Post-hoc rendering:** always rendered as drawn — except factorial, whose card note says the
   simple-effects table appears "when an effect is significant"; factorial renders it
   conditionally. Card fidelity decides per test.
2. **MANOVA/MANCOVA follow-ups:** the drawn header is plain `p` and the card's how-to-read
   instructs the student to adjust — so the table stays **raw p as drawn**; the card's existing
   text does the teaching. (Reversed my initial leaning toward auto-Bonferroni on fidelity
   grounds: changing the numbers under a drawn header is a silent deviation.)
3. **Wide-only** for RM / Mixed / Friedman, as drawn. Long-format data won't satisfy the slots;
   the configure-guide explains wide format. No auto-reshape.
4. **No auto-switching one-way → Welch.** Levene's runs as a check-note that *suggests* Welch's
   ANOVA when violated (t-test toggle ruling R3 pattern); the student chooses the test.
5. **Effect sizes exactly as drawn per card:** η² (one-way) · partial η² (factorial, RM, mixed,
   ANCOVA, M(AN)COVA follow-ups) · ω² (nested) · rank ε² (Kruskal-Wallis;
   `effectsize::rank_epsilon_squared`-class, unrelated to sphericity ε) · Kendall's W (Friedman).
6. **ANCOVA slope homogeneity:** the factor×covariate interaction runs automatically as a
   check-note (Levene pattern) — caution shown when significant, never blocks the run. MANCOVA
   gets the same per-covariate check-note.
7. **Missing data:** listwise per test, own N reported — Benjie's standing R2 ruling.
8. **Multivariate statistics:** Pillai's trace default, Wilks' Λ selectable, both with approx-F
   conversion, per the MANOVA/MANCOVA cards.
9. **Nested ANOVA:** nesting "random" default with "fixed" toggle as drawn — the toggle switches
   the model per the card's R map: `aov(y ~ A + Error(A:B))` (random) vs `aov(y ~ A/B)` (fixed);
   Factor A tested against the nested factor's MS under random nesting, B(within A) against
   residual; ω² effect size via `effectsize::omega_squared` per the card.
10. **Sums-of-squares types follow each card's own R map** (recorded while transcribing the drawn
   cards for the plan): factorial/RM/mixed = Type III via `afex` (SPSS convention, afex default);
   ANCOVA = Type III via `car::Anova(type=3)` (named explicitly on the card); MANOVA = sequential
   `stats::manova()` + `summary(test=...)` (the card's map); MANCOVA = `car::Manova()` (Type II,
   the card's map). One-way/Welch/KW/Friedman have a single term — no type question.

## 5. Problem fixes (Benjie-approved; each is part of the design, not an open risk)

1. **afex under WebR unproven → pre-committed spike decision rule.** Spike gates: afex installs
   under WebR AND reproduces native-R known answers for RM/mixed/factorial including Mauchly W,
   GG/HF ε, and **partial η² via `anova_table(es = "pes")`** (afex defaults to generalized η²,
   which is NOT what the cards draw). If either gate fails, the fallback is pre-specified: base
   `aov` + hand-rolled Mauchly/GG/HF with exact formulas and the same known-answer targets —
   spike verdict changes the implementation path without reopening this design. Verdict reported
   to Benjie before plan-writing either way.
2. **Under-drawn multi-factor outputs → explicit rendering rules** (consistency-tested registry
   text, not builder improvisation): k-factor factorial fits the full model — all main effects +
   all interactions as Source rows; interaction plot uses the first two factors in slot order,
   faceted by additional factors; simple-effects table from emmeans contrasts on significant
   effects only (the card's own conditional note). Same full-model rule for ANCOVA / MANOVA /
   MANCOVA "one or more" factors, adjusted means reported per factor-level combination.
3. **Dunn/Nemenyi/Games-Howell sourcing → priority ladder with pre-written fallback.** Spike
   tries `PMCMRplus` → `rstatix` / `FSA` → hand-rolled, in order. Hand-rolled formulas are
   pre-committed with native-R known-answer targets: Nemenyi = Tukey studentized-range test on
   rank sums; Games-Howell = pairwise Welch-df comparisons against the studentized range
   distribution; Dunn = pairwise z on mean ranks with tie correction and the chosen p-adjustment.
   Worst case is pre-verified work, not a mid-slice detour.
4. **Nested vs crossed data → detection shipped in B5.** Any nested-factor level appearing under
   more than one parent level triggers a warning note on the result card: *"classroom labels
   repeat across schools; results assume distinct groups within each school — check your
   coding"* (exact wording in the registry, consistency-tested; role names substituted). Warns,
   never blocks — Levene-note pattern.
5. **Suite runtime → split scripts.** `test:fast` for the inner loop (seconds); full serialized
   `npm test` stays the commit gate (~15–20 min expected after this slice). Dispatch
   instructions must tell agents the full gate is slow and runs in FOREGROUND with long
   timeouts (core-slice lesson).
6. **Mixed ANOVA post-hoc ambiguity → resolved in the card itself** (we author it): Table 4
   titled "Post-hoc comparisons (condition pairs)" + the how-to-read sentence quoted in
   section 2. Spec text and behavior match exactly.
7. **VFS payload → hard size gate in the spike.** Measure every decompressed VFS file for the
   new packages; criterion: largest file < 25 MiB (Cloudflare hard limit). Violation ejects the
   package and the fallback ladder (fixes 1/3) applies — decided at spike time, not deploy time.

## 6. Testing, verification, sequencing

- **Spike (first, gates everything):** WebR vs native R 4.6.0 cross-check on a fixed fixture for
  all 11 tests' headline numbers — F/df/p per effect, Mauchly W + both ε's, every post-hoc
  procedure's p<sub>adj</sub> on at least one pair, all five effect-size kinds, Pillai and Wilks
  with approx-F — plus the package-availability ladder (fixes 1/3) and the size gate (fix 7).
  Output: a spike report with verdicts, brought to Benjie before plan-writing.
- **Verification split per the regimen:** sphericity corrections, post-hoc p-adjustments,
  effect-size conventions, and multivariate statistics get adversarial fan-out (independent
  native-R recomputation by a separate verifier); pattern-following parts get the lighter
  single-pass treatment. One combined slice-end review of the whole diff replaces per-task
  reviews.
- **Consistency + mutation:** every registry entry consistency-tested against the live spec HTML
  (including the new Mixed ANOVA card), each proven discriminating by mutation. The 46 → 47
  count sweep is itself consistency-tested.
- **e2e — two new journeys, existing journeys byte-untouched:** (a) ANOVA-family combined run:
  one-way + factorial + Kruskal-Wallis on the students fixture, zip unzipped with NN-foldered
  paths asserted; (b) wide-format journey: RM + Mixed + Friedman, asserting the sphericity table
  appears/omits correctly by repeated-factor level count.
- **Sequencing:** Mixed ANOVA card into specs (+ Benjie's rendered-card review) → spike
  (→ verdict to Benjie) → plan (single author + self-review; spot-validate only novel machinery:
  B2/B3 and the wide-data path) → backbone B1–B5 serial on main → 11 parallel worktrees → serial
  integration + full gates → combined slice-end review → Benjie's click-through gate. Nothing
  pushed without his call.

## 7. Out of scope

General mixed designs (multiple between or within factors) — Benjie ruled 1 between × 1 within.
Long-format auto-reshape. Auto-switching between tests. Post-hoc procedures beyond those the
cards name. Report/export formats beyond the established zip (later slice).
