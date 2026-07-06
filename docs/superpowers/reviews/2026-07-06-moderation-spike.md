# Latent-moderation feasibility spike — WebR 0.6.0 ≡ native R 4.6.0

> **2026-07-06.** Pre-build de-risking for latent moderation (CB-SEM interaction term via
> semTools::indProd + lavaan, and PLS-SEM interaction term via seminr's two-stage method),
> before spec/plan. Method mirrors the prior SEM spike
> (`docs/superpowers/reviews/2026-06-18-sem-feasibility-spike.md`): run the IDENTICAL R
> script under native `Rscript` and under WebR, then diff. Scratch harness + scripts in
> `.superpowers/sdd/spike-moderation/`; dataset in `.superpowers/sdd/spike-moderation-data.csv`.

## Verdict: GREEN on both tracks — bootstrap output is byte-identical WebR vs native.

## 1. Dataset

Deterministic LCG (same generator pattern as `.superpowers/sdd/gen-esg-data.mjs`), 3 latent
constructs (SN, TA, TI), 4/4/3 continuous reflective indicators, n=400, with a real interaction
baked into the DGP: `ti = .5*sn + .3*ta + .15*sn*ta + .7*noise`. Indicators left continuous
(not Likert-rounded, unlike the ESG generator) so the interaction signal isn't attenuated by
discretization — this is a stats-feasibility spike, not a realism exercise. Generator:
`.superpowers/sdd/spike-moderation/gen-moderation-data.mjs`.

## 2. Track 1 — CB-SEM latent moderation (semTools::indProd + lavaan)

Script: `.superpowers/sdd/spike-moderation/moderation-spike-cbsem.R` (native run:
`Rscript .superpowers/sdd/spike-moderation/moderation-spike-cbsem.R`; WebR run:
`node .superpowers/sdd/spike-moderation/webr-cbsem.mjs`).

Method: `indProd(data, var1=sn1:4, var2=ta1:4, match=TRUE, meanC=TRUE, doubleMC=TRUE)` — this
signature IS semTools' double-mean-centering method (Lin, Wen, Marsh & Lin 2010) with matched
(not full-crossed) product indicators — builds 4 matched product indicators `sn{i}.ta{i}`.
Model: `SN =~ sn1..4; TA =~ ta1..4; TI =~ ti1..3; SNTA =~ sn1.ta1..sn4.ta4; TI ~ b1*SN + b2*TA + b3*SNTA`,
fit with `se="bootstrap", bootstrap=500`, `set.seed(20260706)` before `sem()` in both runs.

### Headline numbers — interaction term (TI ~ SNTA), unrounded

| Statistic | Native R 4.6.0 | WebR 0.6.0 | Match |
|---|---|---|---|
| B (unstandardized) | 0.25819002 | 0.25819002 | exact |
| SE | 0.06567043 | 0.06567043 | exact |
| z | 3.93160231 | 3.93160231 | exact |
| p | 0.00008438 | 0.00008438 | exact |
| bootstrap 95% CI | [0.13214640, 0.40561818] | [0.13214640, 0.40561818] | exact |
| standardized β | 0.23155625 | 0.23155625 | exact |
| std. SE / z / p | 0.06273084 / 3.69126682 / 0.00022314 | identical | exact |
| R² (TI, structural) | 0.37238998 | 0.37238998 | exact |

Full-precision console diff (fit indices, all 3 structural paths, product-indicator means,
R² table) showed **zero differences** — see `/tmp/native-cbsem-out.txt` / the WebR console log
captured during the run (both reproduced verbatim in this report's development; not persisted
beyond the scratch dir since they're identical to the numbers above).

### Simple slopes — TI ~ SN at TA = -1SD / mean / +1SD (Aiken & West 1991)

Derived directly from the fitted `b1`/`b3` coefficients and the model-implied `TA` latent SD
(0.80189), with CIs from the 500 bootstrap draws of `b1`/`b3` (percentile method, matching
`boot.ci.type="perc"` above). **Bootstrap CI columns are matched WebR vs native to 6 decimals
on every row** — confirms the simple-slope arithmetic (not just the raw path coefficients)
reproduces exactly:

| TA level | slope = b1 + b3·level | bootstrap 95% CI (both engines, identical) |
|---|---|---|
| -1 SD | 0.258827 | [0.129549, 0.395864] |
| mean | 0.465867 | [0.359732, 0.579842] |
| +1 SD | 0.672907 | [0.523766, 0.855240] |

**One real bug caught and fixed during the spike**: `lavInspect(fit, "boot")` columns are
named by the *free-parameter label* used in `coef(fit)` (e.g. `"b1"`, `"b3"`), not by row
position in the full parameter table (which also lists fixed loadings, defined effects, etc.).
An initial version indexed by `ParTable` row number and got a silently-misaligned column,
producing CIs that didn't even contain their own point estimate. Fixed by indexing
`boots[, "b1"]` / `boots[, "b3"]` by name. **This is a real footgun for the build** — any
bootstrap-CI-of-a-derived-quantity code (simple slopes, indirect effects computed post hoc from
draws) must select columns by parameter label, never by row index.

### Timing

| Run | bootstrap(500) | total incl. install/init |
|---|---|---|
| native | 3.94s | ~4.6s |
| WebR | 17.16s (17.18s on the := extension model) | 26.5s (incl. lavaan+semTools install) |

WASM penalty ≈ 4.4×. Extrapolated: **bootstrap=1000 ≈ WebR ~34s** (the e2e/doc-harness preset)
and **bootstrap=5000 ≈ WebR ~2.9 min** (native 39s). No `makeCluster` shim needed here —
lavaan's bootstrap defaults to `parallel="no"` (confirmed in the prior spike, reconfirmed here:
ran clean with only the `detectCores` shim).

## 2b. Scope expansion (adversarial-review items) — all verified WebR ≡ native

Script: `.superpowers/sdd/spike-moderation/moderation-spike-cbsem-ext.R` (native:
`Rscript …`, WebR: `node .superpowers/sdd/spike-moderation/webr-cbsem-ext.mjs`). The entire
R-output body of this script diffed **byte-identical** between native R 4.6.0 and WebR 0.6.0
(only the harness timing footer differs).

### (1) Unequal indicator counts (4×3) — `match=FALSE` runs; RULING: allowed with disclosure

`indProd(var1=sn1..4, var2=ta1..3, match=FALSE, meanC=TRUE, doubleMC=TRUE)` produced all
4×3 = 12 double-mean-centered product indicators and the model estimated cleanly in BOTH
engines, identically (ML SEs; bootstrap parity already proven on the matched model):

| Path (unequal model, ML) | est | SE | z | p |
|---|---|---|---|---|
| TI ~ SN | 0.460302 | 0.053571 | 8.592400 | .000000 |
| TI ~ TA | 0.326802 | 0.053261 | 6.135836 | .000000 |
| TI ~ SNTA (interaction) | 0.176000 | 0.052624 | 3.344501 | .000824 |

Guard confirmed: `indProd(match=TRUE)` on 4×3 **errors** with a clean message
("If the match-paired approach is used, the number of variables in all sets must be equal") —
usable verbatim as the routing condition.

**Ruling: unequal counts → `match=FALSE` (all-possible products, double-mean-centered) WITH
disclosure, not blocked.** Two disclosures required in the rendered report: (a) the strategy
note itself (all-possible products instead of matched pairs); (b) a global-fit caveat — the
all-products model's fit indices are distorted by unmodeled residual covariances among products
sharing an indicator (observed here: CFI .659 / RMSEA .158 from the same clean DGP that fits
the matched model at CFI .998 — the interaction *test* is fine; the global fit indices are not
diagnostic in this configuration). This is exactly the matched-pair vs all-possible-products
contrast studied by **Marsh, Wen & Hau (2004)** (covered by search #1 in §4 — the 2004 paper is
the indicator-construction/estimation-strategies evaluation), whose matched-pair recommendation
(each indicator used once) is why `match=TRUE` stays the default whenever counts are equal;
Lin et al.'s (2010) double-mean-centering applies to either product set.

### (2) Bias-corrected CIs (`bca.simple`) — lavaan parity + hand-rolled reproduction, exact

`parameterEstimates(fit, boot.ci.type = "bca.simple")` (bias-corrected, NON-accelerated — true
BCa needs a jackknife acceleration term; lavaan hardcodes a = 0) on the matched interaction
model, identical in both engines:

| Row | est | bca.simple 95% CI (both engines) |
|---|---|---|
| TI ~ SNTA (b3) | 0.258190 | [0.136018, 0.408682] |
| slope_lo (:=) | 0.258827 | [0.126458, 0.416865] |
| slope_mid (:=) | 0.465867 | [0.353257, 0.576133] |
| slope_hi (:=) | 0.672907 | [0.527041, 0.864202] |

**Hand-rolled reproduction from the raw `lavInspect(fit, "boot")` draws matched lavaan to
machine precision (max |Δ| = 0) in both engines.** The exact recipe (read from lavaan's
`parameterestimates` source, reimplemented in the spike script): z0 = `qnorm(#{draws < est}/R)`,
adjusted levels `pnorm(2·z0 + qnorm(c(.025, .975)))`, then quantiles via the boot-package-style
`norm.inter` interpolation between order statistics on the qnorm scale — NOT plain
`quantile()`; using `quantile()` gives near-but-not-equal values. This hand-rolled function is
what the **PLS track will reuse** on seminr's raw boot matrix (seminr natively exposes only
percentile CIs), so BC CIs come from one lavaan-verified implementation on both tracks.

### (3) Simple slopes as `:=` defined parameters (production design) — exact parity

The production formulation — slopes defined INSIDE the model so bootstrap CIs fall out of the
SAME single run (whiskers at -1SD/mean/+1SD, no continuous band):

```
TA ~~ vta*TA
slope_lo  := b1 - b3*sqrt(vta)
slope_mid := b1
slope_hi  := b1 + b3*sqrt(vta)
```

Identical in both engines (percentile CIs from the same 500-draw run):

| := parameter | est | SE | z | p | perc 95% CI |
|---|---|---|---|---|---|
| slope_lo (-1SD) | 0.258827 | 0.070848 | 3.653244 | .000259 | [0.118099, 0.403052] |
| slope_mid (mean) | 0.465867 | 0.058470 | 7.967644 | .000000 | [0.357182, 0.584177] |
| slope_hi (+1SD) | 0.672907 | 0.085477 | 7.872361 | .000000 | [0.525072, 0.854749] |

Point estimates equal §2's post-hoc arithmetic exactly (same b1 + b3·(±SD)); the CIs differ
slightly from §2's fixed-SD version because the `:=` form propagates the moderator-SD
uncertainty per draw (`sqrt(vta)` recomputed inside each resample) — that correct propagation
is why the `:=` design is the production choice. `sqrt()` inside lavaan `:=` expressions works
identically under WebR.

## 3. Track 2 — PLS-SEM latent moderation (seminr, two_stage)

Script: `.superpowers/sdd/spike-moderation/moderation-spike-plssem.R` (native:
`Rscript .superpowers/sdd/spike-moderation/moderation-spike-plssem.R`; WebR:
`node .superpowers/sdd/spike-moderation/webr-plssem.mjs`).

Model: full `mobi` 7-construct measurement/structural model (same as the prior PLS-SEM spike)
plus `interaction_term(iv="Image", moderator="Expectation", method=two_stage, weights=mode_A)`
and a structural path `Image*Expectation -> Satisfaction`. `bootstrap_model(nboot=500, cores=1)`,
`set.seed(20260706)` before both `estimate_pls` and `bootstrap_model` in both runs. The WebR
harness imports and applies the repo's REAL `MAKECLUSTER_SHIM` from
`src/lib/webr/parallelShim.ts` (not a spike-local reimplementation) — `seminr::bootstrap_model`
always builds a PSOCK cluster even at `cores=1`, which throws `WebSocketServer is not a
constructor` under WASM without it.

### Headline numbers — interaction term (Image*Expectation -> Satisfaction)

| Statistic | Native R 4.6.0 | WebR 0.6.0 | Match |
|---|---|---|---|
| Original Est. | -0.016341 | -0.016341 | exact |
| Bootstrap Mean | -0.015269 | -0.015269 | exact |
| Bootstrap SD | 0.027207 | 0.027207 | exact |
| T Stat. | -0.600612 | -0.600612 | exact |
| 2.5% CI | -0.072192 | -0.072192 | exact |
| 97.5% CI | 0.039888 | 0.039888 | exact |
| Bootstrap p | 0.560000 | 0.560000 | exact |
| Satisfaction R² / AdjR² | 0.681492 / 0.674965 | identical | exact |

The full 13-row bootstrapped-paths table (all main-effect + interaction paths) matched to every
printed decimal, WebR vs native. (The interaction on `mobi`'s naturally-occurring data is small
and non-significant — expected, since `mobi` has no designed interaction; the spike's purpose is
numeric reproducibility, not a claim of a "real" effect in that dataset. Track 1's dataset was
purpose-built with a designed interaction specifically to also prove sensitivity/detection.)

### Timing

| Run | bootstrap(500) | total incl. install/init |
|---|---|---|
| native | 9.57s | ~10.2s |
| WebR | 78.8s | 101.0s (incl. seminr install ~17.3s) |

WASM penalty ≈ 8.2× — consistent with the prior spike's ~8× PLS figure (serial shim removes all
parallelism). Extrapolated: bootstrap=5000 ≈ native 96s / **WebR ≈ 13.1 min**;
bootstrap=10,000 ≈ **WebR ≈ 26.3 min**. This reinforces the existing §4f-style ruling from the
6/18 spike (default a lower interactive bootstrap count with an opt-in "final run" for 10k).

## 4. Convention — citable choices (web-verified, 2 searches)

- **Double-mean-centering, `match=TRUE`**: the modern refinement of Marsh, Wen & Hau's (2004,
  2006) mean-centering strategy for latent-interaction SEM is **Lin, Wen, Marsh & Lin (2010)**,
  "Structural Equation Models of Latent Interactions: Clarification of Orthogonalizing and
  Double-Mean-Centering Strategies" (*Structural Equation Modeling*, 17(3)) — this is the
  citation `semTools::indProd`'s `doubleMC=TRUE` implements. **Confirmed** via web search
  (tandfonline.com/doi/abs/10.1080/10705511.2010.488999); Marsh, Wen & Hau's earlier
  mean-centering paper (2004) is the direct precursor, also confirmed as the baseline the 2010
  paper contrasts against.
- **Simple slopes at -1SD/mean/+1SD**: **Aiken & West (1991)**, *Multiple Regression: Testing
  and Interpreting Interactions*, is the standard citation for probing a two-way interaction at
  ±1SD of the moderator. Search corroborated Aiken & West (1991) as a live, actively-cited
  source specifically in the context of interaction-effect interpretation (including the
  unstandardized-vs-standardized weights caveat this spike's simple-slope arithmetic already
  respects by working in the unstandardized metric). This is a long-established, uncontested
  citation.
- **`two_stage` for PLS moderation**: **Henseler & Chin (2010)**, "A Comparison of Approaches
  for the Analysis of Interaction Effects Between Latent Variables Using Partial Least Squares
  Path Modeling" (*Structural Equation Modeling*, 17(1)) is exactly the paper introducing/
  comparing the product-indicator, two-stage, hybrid, and orthogonalizing PLS interaction
  methods — **confirmed** via web search (the two-stage approach traces further back to Chin,
  Marcolin & Newsted 2003, which Henseler & Chin's simulation favors for parameter recovery and
  power; `seminr::two_stage` is this method).
- **Product-indicator matching**: matched pairs (`match=TRUE`, each indicator used once) per
  **Marsh, Wen & Hau (2004)** when focal and moderator have equal indicator counts; unequal
  counts fall back to all-possible products (`match=FALSE`, still double-mean-centered) with
  the two disclosures in §2b(1).
- **Estimator**: production will FORCE ML + bootstrap SEs for latent moderation — the
  product-indicator approach assumes continuous indicators, so moderation is BLOCKED under
  WLSMV/ordinal estimation (no extra testing needed; recorded as a build constraint).

## 5. Adaptations needed for the build

1. **No new shim for CB-SEM** — lavaan bootstrap is serial by default; `indProd` + latent-
   interaction `sem()` ran clean in WebR with only the existing `detectCores` shim.
2. **Reuse the existing `MAKECLUSTER_SHIM`** (`src/lib/webr/parallelShim.ts`) for PLS
   moderation bootstrap — verified working, byte-identical output, no changes needed to the
   shim itself.
3. **Bootstrap-column-by-label discipline** (§2 bug above) — any code deriving simple slopes,
   conditional indirect effects, or other post-hoc quantities from `lavInspect(fit,"boot")`
   must index columns by the `coef()`/free-parameter label, never by `ParTable` row position.
   Worth a code-review checklist item when the build implements simple-slope tables.
4. **Bootstrap count default** — the PLS moderation path inherits the same ~8× WASM penalty as
   plain PLS-SEM; treat interactively-run moderation bootstraps the same as the existing
   PLS-SEM ruling (lower interactive default, 10k as an explicit opt-in "final run").
5. **BC CIs on both tracks from one implementation** — reuse the hand-rolled z0-adjusted
   percentile (with `norm.inter` interpolation, §2b(2)) for seminr's boot matrix; on lavaan use
   the built-in `boot.ci.type="bca.simple"` (they are provably identical).
6. **Unequal-count routing** — `indProd(match=TRUE)` errors on unequal counts; route to
   `match=FALSE` + the two §2b(1) disclosures (strategy note + global-fit caveat).
7. **Simple slopes via `:=` defined parameters** — production defines the 3 slope levels inside
   the lavaan model (§2b(3)) so all CIs (perc + bca.simple) come from the single bootstrap run;
   no post-hoc draw arithmetic needed on the CB-SEM track.

## Bottom line

Both latent-moderation techniques required by the ROADMAP slice — CB-SEM via
`semTools::indProd` double-mean-centering + lavaan, and PLS-SEM via `seminr::two_stage` — are
**fully feasible in WebR with no blockers**. Every reported statistic (unstandardized B/SE/z,
standardized β, R², percentile AND bias-corrected bootstrap CIs, `:=`-defined simple-slope
estimates + CIs, and the unequal-count `match=FALSE` fallback) reproduces byte-for-byte
against native R 4.6.0. No new WASM shims are required beyond the two already in the codebase
(`detectCores`, `makeCluster` serial shim); CB-SEM moderation bootstrap is fast enough for
interactive use even at 5k (≈2.9 min), while PLS moderation bootstrap inherits the existing
~8× WASM slowdown and should follow the same default/opt-in bootstrap-count pattern already
recommended for plain PLS-SEM. Ready for spec → plan on the owner's word.
