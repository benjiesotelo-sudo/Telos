# Econometrics sub-slice 2 — panel + causal verification spike (native-R ground truth)

**Date:** 2026-06-15 · native R **4.6.0** on `tests/e2e/fixtures/panel.csv` (96 rows, 12 firms × 8 yrs) and
`tests/e2e/fixtures/causal.csv` (200 rows). Reference values the WebR runners must reproduce (≥5 sig figs).
Raw output + the R script: `2026-06-15-panel-causal-spike-data/`.

**Packages** (native R, all load): `plm`, `sandwich`, `lmtest`, `ivreg`, `AER`, `rdrobust`, `MatchIt`.
**`cobalt` is NOT available** → PSM love plot is **hand-rolled in ggplot2** (spec §6 k confirmed).
**WebR runtime cross-check** (does `plm::vcovHC`/`sandwich::vcovCL`/`rdrobust`/`matchit` actually *run* under
WebR 0.6.0, not just load) is performed when the **FE** runner's vitest first executes the real engine — FE is
built first as the gate before fanning out the other six.

---

## Panel (`panel.csv`) — `pdata.frame(P, index=c("firm","year"))`

### Fixed effects — `plm(roa ~ leverage + rd_spend + size, model="within")`, clustered SE `vcovHC(method="arellano", type="HC1", cluster="group")`
| Term | B | Clustered SE | t | p | 95% CI |
|---|---|---|---|---|---|
| leverage | −5.57430 | 1.46699 | −3.7998 | .000279 | [−8.4932, −2.6554] |
| rd_spend | 1.88801 | 0.74343 | 2.5396 | .013010 | [0.4088, 3.3672] |
| size | 0.14007 | 0.42702 | 0.3280 | .743738 | [−0.7096, 0.9897] |

Within R² = **0.914498**, adj = 0.899720 · F = **288.782** (df 3, 81), p = 3.86e-43 · N obs **96**, N entities **12**.
(leverage's within-variation is modest, so its within estimate is amplified vs. the DGP — a faithful
illustration of the card's "little within-entity variation → unreliable estimate" note; the test asserts the
computed value.)

### Random effects — `plm(..., model="random")` (Swamy–Arora), clustered SE
| Term | B | Clustered SE | t | p |
|---|---|---|---|---|
| (Intercept) | −0.76547 | 0.27653 | −2.7681 | .006818 |
| leverage | −4.05360 | 1.28972 | −3.1430 | .002251 |
| rd_spend | 0.54764 | 0.15551 | 3.5216 | .000670 |
| size | 0.95674 | 0.04744 | 20.1691 | <2e-16 |

R² = **0.980050**, adj = 0.979399 · N obs 96, N entities 12.

### Hausman — `plm::phtest(fe, re)`
χ² = **3.071622**, df = **3**, p = **0.380714** → does not reject (RE acceptable). Decision column @ α=.05 → **RE**.
FE vs RE coefs: leverage −5.5743/−4.0536, rd_spend 1.8880/0.5476, size 0.1401/0.9567.

### DiD — `lm(roa ~ treated*post)`, clustered-by-firm SE `sandwich::vcovCL(cluster=~firm)`
| Term | B | Clustered SE | t | p | 95% CI |
|---|---|---|---|---|---|
| (Intercept) | 19.20642 | 0.77919 | 24.649 | <2e-16 | [17.659, 20.754] |
| treated | −6.28650 | 1.09942 | −5.718 | 1.3e-07 | [−8.470, −4.103] |
| post | 2.01508 | 0.09061 | 22.239 | <2e-16 | [1.835, 2.195] |
| **treated:post** | **1.52563** | 0.12239 | 12.466 | <2e-16 | **[1.2826, 1.7687]** |

The Treated×Post (DiD) estimate **1.5256** matches the fixture's designed +1.5 effect.

---

## Cross-sectional causal (`causal.csv`)

### IV / 2SLS — `ivreg(wage ~ educ + exper | educ_iv + exper)`
- **First stage** `lm(educ ~ educ_iv + exper)`: educ_iv coef **1.15696** (SE 0.05525, t 20.94); partial F (vs
  `educ ~ exper`) = **438.5** (so the instrument is strong; the diagnostics' weak-IV F = **451**).
- **2SLS:** (Intercept) 202.740 · **educ 7.82142** (SE 0.28220, t 27.716, p<2e-16) · exper −0.02055.
- **Diagnostics:** Weak instruments F **451** (p<2e-16); Wu–Hausman F **1212** (p<2e-16, confirms endogeneity);
  Sargan **NA** (just-identified — 1 instrument, 1 endogenous — so over-id is untestable, per the card note).
- Robust SE via `sandwich::vcovHC` (used for the 2SLS table SE/CI).

### RDD — `rdrobust::rdrobust(score, running_var, c=50)` (continuous running var, no mass points)
| Row | Estimate | SE | z | p | 95% CI |
|---|---|---|---|---|---|
| Conventional | 9.89703 | 0.17375 | 56.96 | ~0 | [9.5565, 10.2376] |
| Robust | 9.87892 | 0.20585 | 47.99 | ~0 | [9.4755, 10.2824] |

Bandwidth h = 8.6596 · N_h left/right = **18 / 16**. (Estimate ≈ the designed +10 jump.) The card draws a
single RD-estimate row → report the **Conventional** estimate/bandwidth/N with **Robust** SE/z/p/CI (rdrobust's
recommended inference), or as the builder maps it — confirm against this table.

### PSM — `MatchIt::matchit(enroll ~ exper + age + ability, method="nearest", ratio=1)`
Balance (covariates):
| Covariate | SMD pre | SMD post | Var. ratio post |
|---|---|---|---|
| exper | −0.040 | −0.002 | 1.017 |
| age | 0.128 | 0.069 | 0.929 |
| ability | **1.359** | **0.373** | 1.298 |

ATT `lm(health ~ enroll, matched, weights)` clustered-by-subclass SE: **5.86866** (SE 0.22774, t 25.77, p<2e-16),
95% CI [5.4182, 6.3191], matched n = **134**. Naive (unmatched) diff = 9.353 → matching removes most of the
ability confound, recovering ATT ≈ the true 5. (A caliper of 0.1 tightens ability SMD to ~0.075 and ATT to
~5.31 — a guide note on the caliper option; default is off, as drawn.)

---

## Fixture-design decisions (made during this spike — for the ratify list)
- **`panel.csv`** (deterministic, `build-panel.mjs`): firm intercept correlates with the `rd_spend` baseline so
  FE/RE diverge and Hausman is non-trivial; a clean +1.5 DiD effect on `treated×post`. Kept as-is (FE leverage
  amplified by low within-variation is a faithful illustration, not a bug).
- **`causal.csv`** (deterministic, `build-causal.mjs`): separate clean outcome per method. Two tunings the
  spike forced: (1) **RDD running variable made continuous** (integer base + jitter → 200 distinct values) to
  avoid rdrobust "mass points"; (2) **PSM treatment made probabilistic with a negative intercept**
  (`enroll ~ logistic(−0.7 + 0.6·ability) > deterministic-uniform`) → 67 treated / 133 control, giving common
  support so default nearest matching reduces the ability imbalance and recovers ATT ≈ 5.
- **`cobalt` unavailable** → PSM love plot hand-rolled in ggplot2 from the balance table.
- **IV just-identified** (Sargan NA) — simplest faithful case; the card's note already covers "Sargan
  unavailable for just-identified models".
