# Telos — Regression & Prediction Family Slice (Design)

**Date:** 2026-06-12
**Status:** Written for Benjie's spec review. Scope and the two design forks were ruled in the
brainstorm session (R1 toggle semantics = em-dash cells; R2 amend "changeable" out of the
multiple-linear guide, defer the reference-level picker); structure ruling = Approach A (thin
backbone, then parallel per-test worktrees).
**Process:** the lighter regimen ruled 2026-06-12 (`docs/superpowers/ROADMAP.md`): keep the
statistical spike, card-scoped consistency tests + mutation checks, full gates every commit, and
the end click-through; drop the full-plan sandbox replay (spot-validate novel machinery only),
per-task reviews for pattern-following tasks (one combined slice-end review instead), and
multi-agent plan authoring. Parallel per-test worktrees + serial integration per Benjie's ruling.

## 1. Scope — Benjie's rulings (2026-06-12)

Four tests into the finished shell, family **4 · Regression & prediction**. All four cards are
already drawn in both companion spec HTMLs — no new card authoring this slice. 29/47 live after
the slice.

| # | Test | Catalog id | Roles (arity) | Options drawn |
|---|------|-----------|----------------|----------------|
| 1 | Simple linear regression | `simple-linear-regression` | Outcome (1, interval/ratio), Predictor (1, any level) | α · CI |
| 2 | Multiple linear regression | `multiple-linear-regression` | Outcome (1, interval/ratio), Predictors (1+, any level) | α · CI · standardize (off) |
| 3 | Logistic regression | `logistic-regression` | Outcome (1, nominal, exactly 2 categories), Predictors (1+, any level) | α · CI · report odds ratios (on) · event category (second level) |
| 4 | Poisson / negative binomial | `poisson-negative-binomial` | Outcome (1, count), Predictors (1+, any level), Exposure (0–1, interval/ratio, offset) | model (Poisson) · α · CI · offset (from Exposure) |

**Structure ruling: Approach A — thin backbone, then 4 parallel worktrees.** No shared regression
chassis: the four tests' tables genuinely differ (t vs z statistics, β vs OR vs IRR, different
fit columns), so a common coefficient-table module would grow flags. The backbone exists only
for machinery that touches shared files (`types.ts`, eligibility, TestConfigScreen, engine
preload, spec HTML), frozen on main before the worktrees fan out.

**Fork rulings (AskUserQuestion, 2026-06-12):**

- **R1 — toggle semantics: off → em-dash cells.** The output tables' column sets are card-fixed,
  so output-affecting toggles never add/remove columns: `standardize` off (the drawn default)
  renders — in multiple linear's β cells, on fills them; `report odds ratios` off renders — in
  logistic's OR + 95% CI (OR) cells, on (the drawn default) fills them. Simple linear draws no
  standardize pill → its β is always computed and filled. α and CI pills remain the display-only
  house convention (ratified for Association).
- **R2 — reference-level "changeable" amended out, picker deferred.** Multiple linear ships
  first-alphabetical dummy-coding reference (R's factor default); the word "changeable" is
  dropped from that one guide sentence in `telos_test_inputs.html` (the sentence appears only
  there — outputs file has no inputs guides). A reference-level picker is a polish-slice
  candidate. Benjie's spec review covers the edit.

## 2. Backbone (serial phase on main, frozen before worktrees fan out)

- **B1 — count-tag role constraint** (novel machinery → spot-validated per the regimen).
  `RoleConstraint` gains optional `tag?: 'count'`; `slotCompatibility` additionally requires
  `col.tags` to include it, with the readable reason "needs a count column (non-negative whole
  numbers)". Sole consumer: the Poisson outcome slot (`count · non-negative integers · exactly
  1` as drawn). `columnMeta` already tags non-negative-integer columns `count` — no detection
  changes. The palette house rule is unchanged: a non-count ratio column still fits Predictors,
  so it stays compatible on the card.
- **B2 — `level-select` option kind** (novel machinery → spot-validated). New member of
  `OptionSpec.kind` + TestConfigScreen rendering: a select whose choices are resolved at runtime
  from the categories of the column assigned to a named role (spec field `fromRole:
  'outcome'`). Powers logistic's **event category** pill: choices = the outcome column's two
  levels, default = **second level** (alphabetical order — matching the drawn `passed · second
  level` and R's glm convention of modeling the second factor level). Stored in the session as
  the chosen level string; reset to the default when the outcome column is unassigned or
  reassigned. While no outcome is assigned the pill shows the drawn placeholder state and the
  run gate already blocks on the empty role.
- **B3 — spec amendment** (the R2 edit above) committed before any consistency test transcribes
  the card, so the registry asserts against the amended truth.
- **B4 — engine preload.** New card-named packages, ship list decided by the spike (section 4):
  `parameters` (β), `performance` (Nagelkerke R², dispersion check), `broom` (named on the
  simple-linear R map), `pROC` (ROC/AUC), `caret` (classification table — expected casualty),
  `MASS` (glm.nb — ships with base R, load check only). `car` (VIF) already ships. Whatever
  ships goes through `scripts/copy-webr.mjs` preload + decompressed-VFS rules, with the
  established < 25 MiB-per-file size gate.

## 3. Per-test work and recorded conventions

**Per-test shape (all 4, the established pattern):** registry entry transcribed byte-faithful
from its card + consistency test against the live spec HTML + mutation check; stats module
(R call via the shared engine, spike-verified known answers); builder; unit tests. Worktree
implementers touch only their own files + fixtures; catalog flip and RUNNERS/BUILDERS
registration happen in the serial integration task.

**Recorded conventions (delegated; Benjie audits here, in the rendered app, and on the
slice-end ratify list):**

1. **Coefficient term rows:** intercept row renders `(Intercept)` with β (and VIF, where drawn)
   blank, per the ghost rows; numeric predictors one row each under their column name;
   categorical predictors one row per non-reference level, named `<column>: <level>`
   (e.g. `group: b`) — prettier than R's glued `groupb`, unambiguous for multi-level factors.
2. **β (standardized coefficients)** via `parameters::standardise_parameters` (refit method, the
   card's R map); hand fallback if the package fails the spike: β = B·SD(x)/SD(y) for numeric
   terms (dummy terms standardized the same way, matching the refit values — spike pins
   equivalence before the fallback is trusted).
3. **Model-fit SE** (simple linear Table 1) = residual standard error, `summary(m)$sigma`.
4. **VIF** (multiple linear) via `car::vif`; with exactly 1 predictor VIF is undefined
   (`car::vif` errors) → VIF cells render em-dash. Multi-level categorical predictors:
   `car::vif` returns GVIF per term — the table reports plain VIF for 1-df terms and
   **(GVIF^(1/(2·Df)))²** for multi-df terms so all rows are comparable on the VIF scale; the
   spike pins the exact convention against native R and the per-dummy row mapping (every dummy
   row of one factor shows its parent term's value).
5. **95% CIs for coefficients:** `confint()` — t-based for lm; profile-likelihood for glm/glm.nb
   (the cards' `exp(cbind(OR/IRR=coef(m), confint(m)))` recipe). CI level follows the drawn CI
   pill value (95%, display-only).
6. **Logistic model fit:** −2LL = `−2·logLik(m)`; omnibus χ² = null deviance − residual
   deviance, df = k (predictor terms), p from `pchisq`; Nagelkerke R² via
   `performance::r2_nagelkerke` (hand formula fallback, same targets).
7. **Event category** re-levels the outcome so the chosen level is the modeled "event" (glm's
   second factor level); the classification table's column/row headers use the real level
   names. Switching the pill flips coefficient signs / inverts ORs — spike pins both states.
8. **Classification table follows the drawn header literally:** `Predicted \ Observed` — one row
   per predicted level (real level names), columns = observed levels + **% correct** = of cases
   predicted as that level, the percentage actually that level. Cutoff: predicted probability
   ≥ 0.5 → event. No overall-accuracy row (none is drawn). Computed by hand (a 2×2 tabulation);
   `caret` is not needed even if it loads.
9. **ROC + AUC:** `pROC` if it loads under WebR (D1); fallback = hand-rolled ROC points
   (sweep thresholds over fitted probabilities) + exact AUC via the rank / Mann–Whitney
   identity — same known-answer targets either way. Figure drawn in ggplot2 in both branches
   (house styling), AUC annotated on the figure as the card's `(with AUC)` requires.
10. **Poisson/NB dispersion column:** under Poisson = Pearson χ²/df ratio (the
    `performance::check_overdispersion` statistic; hand = `sum(residuals(m,
    "pearson")²)/df.residual`); under negative binomial = **theta** (the card note's exact
    prescription). The drawn dispersion note ships card-literal/static.
11. **Negative binomial:** `MASS::glm.nb`; with Exposure assigned the offset enters the formula
    as `offset(log(exposure))` for both models. Run gate: exposure values strictly positive
    (named-gate hint). The `offset: from Exposure` pill is display-only — it reflects the role
    slot, exactly as drawn.
12. **Figures:** simple linear = fitted-line scatter (`geom_smooth(method = "lm")`, house
    styling) + residual diagnostics; multiple linear = residual diagnostics only (the card's
    "(and optional coefficient plot)" is marked optional → skipped this slice, polish
    candidate); Poisson/NB = fitted-vs-residual plot. Residual-diagnostics composition (e.g.
    residuals-vs-fitted + Q–Q panels) pinned by the spike exemplar; pure ggplot2 — no
    `performance::check_model` dependency.
13. **Assumption-check notes** (simple, multiple) ship card-literal/static, like the drawn
    Poisson dispersion note. No dynamic violation warnings beyond what the cards draw.
14. **Min rules (existing kinds, draft family approximations as before):** simple/multiple =
    `complete-pairs` n ≥ 3 (a ratio-outcome candidate + a predictor candidate with ≥ 3 complete
    pairs; the real adequacy gate is the run itself); logistic = a 2-category nominal candidate
    (`categories.exact: 2`) + ≥ 3 complete pairs; Poisson = a count-tagged candidate + ≥ 3
    complete pairs. The four tests share `domId` decoupling where table ids collide on a
    combined results page (all four draw `table_model-fit` + `table_coefficients` — t-family
    precedent; zip filenames keep the card-faithful names).
15. **Missing data:** listwise per test across DV + predictors (+ exposure), own N reported —
    Benjie's standing ruling.

## 4. Pre-committed decision rules (spike-gated, no design reopening)

- **D1 — ROC source ladder:** `pROC` loads under WebR and matches native R AUC → ship it;
  otherwise hand-roll (convention 9) against the same known-answer targets — PMCMRplus/
  rcompanion precedent. The card's R map only changes if the fallback fires (one-line
  amendment, flagged to Benjie at slice end).
- **D2 — β source ladder:** `parameters` loads → ship it; else hand-roll (convention 2), spike
  pins equivalence first.
- **D3 — Nagelkerke source ladder:** `performance` loads → `r2_nagelkerke`; else the hand
  formula (1 − exp((D − D₀)/n)) / (1 − exp(−D₀/n)) — spike pins both to identical values. If
  `performance` fails, the dispersion ratio also goes hand (convention 10's formula).
- **D4 — `caret`:** load-checked for the record only; the classification table is hand-computed
  regardless (convention 8), so no ladder. If it never ships, the card's R map line naming
  `caret::confusionMatrix()` gets the same one-line truth-fix treatment as D1, flagged at slice
  end.

## 5. Testing, verification, sequencing

- **Spike (first, gates the plan):** one fixture designed to exercise everything — numeric +
  categorical predictors, a binary outcome, a count outcome, an exposure column, mild
  overdispersion. WebR ≡ native R 4.6 cross-check on **every table cell of all four tests**:
  lm fit + coefficients incl. β and profile/t CIs; VIF (incl. the GVIF convention and the k=1
  error); logistic −2LL/AIC/Nagelkerke/omnibus χ²/OR CIs/classification cells/AUC under **both
  event categories**; Poisson and NB fits incl. dispersion ratio, theta, IRR CIs, with and
  without exposure. Package load checks under webr 0.6.0: `parameters`, `performance`, `broom`,
  `pROC`, `caret`, `MASS::glm.nb` — D1–D4 ladders resolved. Residual-figure recipes pinned.
  Ground truth + report committed under `docs/superpowers/reviews/regression-spike-data/`.
  Spike verdict reported with the plan (the ladders mean no verdict blocks; only an unforeseen
  failure would).
- **Consistency + mutation:** every registry entry consistency-tested against the live
  (amended) spec HTML, each proven discriminating by mutation — the established gate.
- **Spot-validation (novel machinery only):** B1 count-tag constraint + B2 level-select kind —
  a focused sandbox check (count column gates the Poisson outcome slot; event-category choices
  appear on drop, reset on reassignment, chosen level reaches R and flips the OR) rather than a
  full-plan replay.
- **e2e — one new journey, existing journeys byte-untouched:** all four tests in one session on
  a regression fixture: drag flows incl. the optional Exposure slot, flip `standardize` on
  (β fills) and verify the off-state em-dash, switch event category, switch model to negative
  binomial, run, assert spike-pinned key numbers, download zip, verify NN-foldered
  card-faithful filenames.
- **Combined slice-end review:** one opus review of the whole diff (replaces per-task reviews),
  with independent native-R recomputation of each test's headline numbers and a UI spot-check.
- **Sequencing:** spec amendment (B3) → spike (→ report with plan) → plan (single author +
  self-review) → backbone B1/B2/B4 serial on main → 4 parallel worktrees → serial integration +
  full gates (tsc · full vitest · build · e2e) → combined review → README/ROADMAP update →
  **Benjie's click-through gate with screenshots, evidence, and the ratify list. Nothing pushed
  or deployed without his call.** Gates ×2 green + fresh-clone proof before completion is
  claimed. Reminder on record: the dogfood audit runs after this slice, covering Association +
  Regression together.

## 6. Out of scope

Reference-level picker (R2, polish candidate). Coefficient plot (optional figure, skipped).
Interaction terms / polynomial terms / model comparison & stepwise selection (no card draws
them). Multinomial / ordinal logistic (separate future cards don't exist; logistic card is
binary-only as drawn). Zero-inflated count models. Hosmer–Lemeshow test. Cross-validation.
`performance::check_model` figures. Export formats beyond the established zip.
