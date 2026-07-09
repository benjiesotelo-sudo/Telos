# H1 estimator/missing wiring spike - findings

Date: 2026-07-10.
Scope: Task 0 of the H1 wiring slice (wire the CB-SEM card's estimator ML/MLR/WLSMV and
missing-data listwise/FIML/pairwise dropdowns into the real lavaan fit).
This is the hard gate for the slice - the numbers here are the pinned expectations for
Tasks 4, 5, and 10.

Scripts:
- `scripts/spikes/h1-estimator-spike.R` (native R, run via `Rscript`)
- `scripts/spikes/h1-estimator-spike.node.mjs` (WebR twin, run via `node`)
- `scripts/spikes/h1-mlr-pairwise-corroboration.R` (Q2 corroboration on an independent dataset)
- `scripts/spikes/h1-pin-values.R` (sprintf transcription aid for the pinned tables below)

Captured output:
- `scripts/spikes/h1-spike-native.txt` (native R, exit 0)
- `scripts/spikes/h1-spike-webr.txt` (WebR 0.6.0 under Node, exit 0)
- `scripts/spikes/h1-mlr-pairwise-corroboration.txt` (exit 0)
- `scripts/spikes/h1-pin-values.txt` (exit 0)

Environment: native R 4.6.0, lavaan 0.6-21 (`packageVersion("lavaan")` confirmed).
WebR 0.6.0 (`webr` npm package `^0.6.0`, `new WebR()` default config, matching the
harness pattern in `docs/superpowers/reviews/2026-06-18-sem-spike-data/webr-sem-spike.mjs`).

## Fixture provenance (seed 20260710)

Both fixtures are written by `scripts/spikes/h1-estimator-spike.R` under `set.seed(20260710)`:

1. `scripts/spikes/politicalDemocracy-missing.csv` - `lavaan::PoliticalDemocracy` (75 rows)
   with 6 seeded NA holes punched independently into each of `y1`, `y2`, `y3`, `y4`
   (`sample(seq_len(nrow(pd)), size = 6)` per column, indices may overlap across columns).
   Used for the ML/MLR x listwise/ml/pairwise matrix (Q1/Q2/Q4).
2. `docs/testing/likert5.csv` - a synthetic n=300 fixture: one latent `lv <- rnorm(n)`
   drives 6 five-level Likert items (`a1..a3` positively, `b1..b3` negatively, via
   `cut()` on `lv + rnorm(sd=.8)` with breaks `c(-Inf,-1,-.3,.3,1,Inf)`) plus 2 continuous
   indicators (`cont1`, `cont2` = `lv + rnorm(sd=.5)`). No NA holes are punched into this
   fixture (see Q3 note below - this is a real, load-bearing observation, not an oversight).
   Used for the WLSMV mixed-indicator-type matrix (Q3).

Both fixtures are deterministic: re-running `scripts/spikes/h1-estimator-spike.R` reproduces
them byte-for-byte because `set.seed(20260710)` is called immediately before each `sample()`/
`rnorm()` sequence that produces them.

## Q1: exact fitMeasures() names per estimator (robust vs scaled)

Extracted programmatically (`names(fitMeasures(fit))`), not by eye from the wrapped console
output, to avoid transcription error. Verified against the printed native output at the line
ranges cited in the pinned-values table below.

**ML** (46 names total). No `.scaled` or `.robust` suffixed names exist at all under plain ML.
Full list: `npar, fmin, chisq, df, pvalue, baseline.chisq, baseline.df, baseline.pvalue, cfi,
tli, nnfi, rfi, nfi, pnfi, ifi, rni, logl, unrestricted.logl, aic, bic, ntotal, bic2, rmsea,
rmsea.ci.lower, rmsea.ci.upper, rmsea.ci.level, rmsea.pvalue, rmsea.close.h0,
rmsea.notclose.pvalue, rmsea.notclose.h0, rmr, rmr_nomean, srmr, srmr_bentler,
srmr_bentler_nomean, crmr, crmr_nomean, srmr_mplus, srmr_mplus_nomean, cn_05, cn_01, gfi,
agfi, pgfi, mfi, ecvi`.

**MLR** (78 names total = the 46 ML names, unchanged, plus 32 more). MLR adds BOTH a
`.scaled` family (19 names) AND a `.robust` family (9 names), and both are populated with
real (non-NA) numbers:
- `.scaled`: `chisq.scaled, df.scaled, pvalue.scaled, baseline.chisq.scaled,
  baseline.df.scaled, baseline.pvalue.scaled, cfi.scaled, tli.scaled, nnfi.scaled,
  rfi.scaled, nfi.scaled, pnfi.scaled, ifi.scaled, rni.scaled, rmsea.scaled,
  rmsea.ci.lower.scaled, rmsea.ci.upper.scaled, rmsea.pvalue.scaled,
  rmsea.notclose.pvalue.scaled`.
- `.robust`: `cfi.robust, tli.robust, nnfi.robust, rni.robust, rmsea.robust,
  rmsea.ci.lower.robust, rmsea.ci.upper.robust, rmsea.pvalue.robust,
  rmsea.notclose.pvalue.robust`.
- Plus `chisq.scaling.factor, baseline.chisq.scaling.factor, scaling.factor.h1,
  scaling.factor.h0` (4 more names, not `.scaled`/`.robust` suffixed).
- `fitMeasures(fit)` for an MLR fit also carries an `attr(,"scaled.test")` attribute; observed
  value `"yuan.bentler.mplus"` for this model (see native output lines 268-269, 367-368).

**WLSMV** (70 names total). Confirmed by fitting the Q3 mixed-indicator model.
- Has the SAME `.scaled` (19 names, identical list to MLR's) and the SAME `.robust` KEY NAMES
  (identical 9-name list to MLR's) - the `.robust` keys are **not absent** under WLSMV.
  However every `.robust` VALUE is `NA` under WLSMV (verified: `fitMeasures(fit)[grep("\\.robust$",
  names(fitMeasures(fit)))]` returns all-NA for `cfi.robust, tli.robust, nnfi.robust,
  rni.robust, rmsea.robust, rmsea.ci.lower.robust, rmsea.ci.upper.robust,
  rmsea.pvalue.robust, rmsea.notclose.pvalue.robust`).
- WLSMV does not carry `logl, unrestricted.logl, aic, bic, ntotal, bic2, ecvi` (no ML-family
  likelihood under WLS estimation) or `scaling.factor.h1/h0` (MLR-specific), and adds `wrmr`
  (weighted root mean square residual - WLS-family-specific fit index, not present under ML
  or MLR).
- `chisq`/`pvalue` (the unscaled naive chi-square p-value) and `baseline.pvalue` print as `NA`
  under WLSMV; only the `.scaled` chisq/pvalue/baseline family carries real values (see native
  output lines 399-414).
- `fitMeasures(fit)` for a WLSMV fit carries `attr(,"scaled.test")` = `"scaled.shifted"`
  (native output lines 469-470, 606-607).

**Ruling for Task 5 (per the brief's contingency clause)**: `.robust` is a valid key under
WLSMV but always NA-valued, so Task 5's fit-index reporting must use the `.scaled` family for
WLSMV (never `.robust`), and may use either `.scaled` or `.robust` for MLR (both are populated
and differ numerically - `.robust` divides by the sample-size-adjusted robust variance,
`.scaled` is the Satorra-Bentler-style mean/variance-adjusted statistic; see the pinned values
below for both). The recommended `fm` vector for Task 3's fit-index extraction should therefore
branch on estimator: ML -> unsuffixed names only; MLR -> prefer `.robust` (matches app's
existing SEM-A CFI/RMSEA convention per memory: "omega-headline+alpha-secondary" style
preference for robust-first reporting) with `.scaled` as fallback; WLSMV -> `.scaled` only.

## Q2: does missing="ml"/"pairwise"/"listwise" run under sem() for ML and MLR?

Matrix result (6 cells: ML x {listwise, ml, pairwise}, MLR x {listwise, ml, pairwise}):

| estimator | missing | result |
|---|---|---|
| ML | listwise | OK |
| ML | ml (FIML) | OK |
| ML | pairwise | OK (see caveat below) |
| MLR | listwise | OK |
| MLR | ml (FIML) | OK |
| MLR | pairwise | **FAILS - hard error, not a warning** |

**MLR + pairwise fails.** Evidence: `lavaan::sem(model, data = pd, estimator = "MLR", missing
= "pairwise")` throws `Error in eigen(VarCov, symmetric = TRUE, only.values = TRUE) :
infinite or missing values in 'x'` from inside `lav_lavaan_step13_vcov_boot -> lav_model_vcov
-> eigen` (native output line 397; identical error text and call stack reproduced under WebR,
webr output line 405). This is a hard `stop()`, not a warning - confirmed with
`options(warn = 1)` plus a `tryCatch(..., warning = ...)` wrapper: no warning fires before the
error, and the fit object is `NULL` (never partially constructed).

Root cause, confirmed not fixture-specific: reproduced independently with a fresh, clean n=5000
two-factor model with 5% MCAR holes scattered across all 6 indicators (different seed, no
overlap with the PoliticalDemocracy fixture) - same error, same call stack; and the same
data/model runs fine under `missing="listwise"` and `missing="ml"`. Committed as
`scripts/spikes/h1-mlr-pairwise-corroboration.R` with captured output
`scripts/spikes/h1-mlr-pairwise-corroboration.txt` (exit 0). Root cause is
documented in lavaan's own `?lavOptions` help for the `missing` argument: `"pairwise"` deletion
is explicitly scoped to "the (W)LS family" as its only non-listwise option; the `missing="ml"`
alias (`"fiml"`/`"direct"`) is documented as available "if the estimator belongs to the ML
family" - `"pairwise"` is not listed as a supported option for the ML family at all. In
practice `missing="pairwise"` combined with plain `ML` runs without lavaan rejecting it
up front (undocumented but functional for point estimates - the pairwise-deleted covariance
matrix is used directly as ML's sufficient statistic). Combined with `MLR`, the same pairwise
covariance matrix is not positive definite in a way that supports the robust
(Huber-White sandwich) variance-covariance computation MLR needs for its `.scaled`/`.robust`
standard errors, and the internal `eigen()` call inside the robust vcov step receives
NA/Inf entries and errors out.

**Ruling for Tasks 4/5**: the missing-data dropdown must either (a) disable/hide "pairwise" as
an option whenever the estimator is MLR (recommended - "pairwise" is undocumented even for
plain ML), or (b) catch this specific lavaan error and surface a clear "MLR does not support
pairwise deletion; use listwise or FIML" message rather than letting the raw eigen() error
reach the UI. The spike script itself demonstrates the required guard: wrap the `sem()` call in
`tryCatch(..., error = function(e) ...)` (see the DEVIATION comment in
`scripts/spikes/h1-estimator-spike.R`) so one failing cell does not crash whatever surrounds it.

`missing="ml"` (FIML) and `missing="listwise"` both run cleanly for ML and MLR with no
warnings.

## Q3: does WLSMV fit with mixed ordered= + continuous indicators?

Yes. `docs/testing/likert5.csv` (6 ordinal items `a1..a3`/`b1..b3`, 2 continuous items
`cont1`/`cont2`) fits under `estimator = "WLSMV", ordered = c("a1","a2","a3","b1","b2","b3")`
for both `missing = "listwise"` and `missing = "pairwise"` with no errors or warnings
(native output lines 398-671; reproduced under WebR at lines 406-681, agreement within the
uniform 7dp cross-engine tolerance rule - see "Cross-engine parity" below).

**Load-bearing observation**: the `listwise` and `pairwise` WLSMV outputs are **byte-for-byte
identical** (confirmed via `diff`). This is not a bug in lavaan or the spike - the brief's own
script never punches missing-data holes into the likert fixture
(`anyNA(read.csv("docs/testing/likert5.csv"))` is `FALSE`), so there is nothing for the two
missing-data modes to treat differently. This is a real gap for whichever production task
(4, 5, or 10) writes the WLSMV+missing test coverage: the pinned values below only prove WLSMV
tolerates the `missing=` argument being present and does not error, NOT that WLSMV actually
handles genuine missingness differently under listwise vs pairwise. If that distinction needs
its own test, a future fixture must punch real holes into a WLSMV/ordered dataset (the
`likert5.csv` generator in `h1-estimator-spike.R` can be reused with an added seeded
`pd[idx, col] <- NA` loop matching the PoliticalDemocracy fixture's pattern).

## Q4: are parameterEstimates() CIs without bootstrap delta-method (Wald) CIs?

Yes, confirmed from lavaan's own source, not just its documentation. `deparse(body(lavaan::parameterEstimates))`
shows the exact branch (lines ~152-158 of the function body):

```r
if (se && object@Options$se != "none" && ci) {
    a <- (1 - level)/2
    a <- c(a, 1 - a)
    if (object@Options$se != "bootstrap") {
      fac <- qnorm(a)
      ci <- tmp.list$est + tmp.list$se %o% fac
    }
    else if (object@Options$se == "bootstrap") { ... }
```

So whenever `se != "bootstrap"` (true for every cell in this spike - none requested
`se="bootstrap"`), `ci.lower`/`ci.upper` = `est +/- qnorm(alpha) * se`: a standard
Wald/normal-approximation interval built on whatever `se` was computed, confirming the CIs
printed for cells 4-8 (parameterEstimates() rows 4-8, the `dem60=~y1..y4` loadings and the
`dem60~ind60` structural path - see pinned values below) are delta-method CIs, not bootstrap
percentile/BCa intervals. This matches lavaan's own `?parameterEstimates` documentation, which
separately states (for the `boot.ci.type` argument) that the p-value "is still computed
assuming that the z-statistic follows a standard normal distribution."

The `se` itself is estimator-dependent (confirmed via `fit@Options$se`): `ML` defaults to
`"standard"` (classical information-matrix delta-method SE); `MLR` defaults to
`"robust.huber.white"` (sandwich/robust SE, itself still an asymptotic delta-method
derivative, just with a robust variance estimator plugged in); `WLSMV` defaults to
`"robust.sem"`. In every case the CI formula is the same Wald `est +/- qnorm*se` - the
"robustness" changes which `se` feeds the formula, not the interval construction itself.

## Q5 (WebR twin only): does a JS NaN in an env array arrive in R as NA?

**Yes - confirmed `is.na()` TRUE.** Test: `webR.evalRVoid(rCode, { env: { jsNanArr: [1, 2,
NaN, 4] } })` where `rCode` writes `is.na(jsNanArr)` to a file (avoiding the
`captureR`-in-Node WebSocketServer issue - see harness note below) and reads it back.

Captured output (`scripts/spikes/h1-spike-webr.txt` lines 684-686):
```
values: 1 2 NaN 4
is.na: FALSE FALSE TRUE FALSE
NA-ok
```

This uses the exact same marshalling mechanism the production app uses
(`src/lib/webr/engine.ts`'s `runJson`/`capturePlot`, both of which bind JS values into R via
`shelter.captureR(rBlock, { env })` / `webr.evalRVoid(code, { env })`). This confirms the
full-rows env path Task 3 needs (marshalling a data matrix with NaN holes for FIML) is sound:
a JS `NaN` placed in a numeric env array is not silently coerced to `0` or dropped - it arrives
in R as a proper missing value that `is.na()`, `missing="ml"`, and lavaan's FIML machinery will
all treat correctly.

## Pinned 8dp values

All values below were reproduced with `sprintf("%.8f", x)` (see the extraction note below) and
cross-checked against the primary captured output in `scripts/spikes/h1-spike-native.txt`
(the `print(x, nd = 8)` output at the cited line ranges - see the DEVIATION note on why
`nd = 8` was needed instead of the brief's plain `round(x, 8)`).

**Note on precision extraction**: the values below were regenerated with the committed
`sprintf("%.8f", ...)` transcription script `scripts/spikes/h1-pin-values.R` (captured output
`scripts/spikes/h1-pin-values.txt`) for clean, unwrapped transcription (lavaan's console
printer wraps wide numeric vectors across multiple lines, which is fine to read but error-prone
to hand-copy at 8dp). Every value was verified to match the corresponding entry in the
committed `h1-spike-native.txt` at the line ranges cited per cell, so every pinned digit is
independently re-derivable: `Rscript scripts/spikes/h1-pin-values.R`. The committed
`h1-spike-native.txt`/`h1-spike-webr.txt` remain the primary provenance artifacts.

### Cell 1: ML / listwise (native lines 3-53, webr lines 11-53)

| measure | value |
|---|---|
| chisq | 23.53908699 |
| df | 13.00000000 |
| pvalue | 0.03564413 |
| cfi | 0.96436775 |
| tli | 0.94244021 |
| rmsea | 0.12486138 |
| srmr | 0.05840425 |

| PE row | param | est | se | ci.lower | ci.upper |
|---|---|---|---|---|---|
| 4 | dem60 =~ y1 | 1.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| 5 | dem60 =~ y2 | 1.26184933 | 0.21078051 | 0.84872713 | 1.67497153 |
| 6 | dem60 =~ y3 | 1.19007981 | 0.16961670 | 0.85763719 | 1.52252244 |
| 7 | dem60 =~ y4 | 1.26358143 | 0.15296677 | 0.96377207 | 1.56339079 |
| 8 | dem60 ~ ind60 | 1.49440497 | 0.47740694 | 0.55870456 | 2.43010538 |

### Cell 2: ML / ml (FIML) (native lines 54-137, webr lines 62-145)

| measure | value |
|---|---|
| chisq | 22.15981477 |
| df | 13.00000000 |
| pvalue | 0.05293449 |
| cfi | 0.97593041 |
| tli | 0.96111835 |
| rmsea | 0.09692617 |
| srmr | 0.03788058 |
| cfi.robust | 0.96777765 |
| tli.robust | 0.94794851 |
| rmsea.robust | 0.11587850 |

| PE row | param | est | se | ci.lower | ci.upper |
|---|---|---|---|---|---|
| 4 | dem60 =~ y1 | 1.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| 5 | dem60 =~ y2 | 1.34451472 | 0.21374293 | 0.92558628 | 1.76344316 |
| 6 | dem60 =~ y3 | 1.18582369 | 0.17509044 | 0.84265274 | 1.52899464 |
| 7 | dem60 =~ y4 | 1.39169375 | 0.18348138 | 1.03207686 | 1.75131064 |
| 8 | dem60 ~ ind60 | 1.46283905 | 0.38994176 | 0.69856724 | 2.22711085 |

Note: `ML` does not carry `.robust` fitMeasures names when `missing="listwise"` (Cell 1 has
none), but DOES carry them when `missing="ml"` here (FIML with `test` defaulting to a
Yuan-Bentler-style correction under incomplete data) - this is an `missing=` effect on the
name SET, not just values, worth flagging for Task 3's `fm` vector selection logic.

### Cell 3: ML / pairwise (native lines 138-188, webr lines 146-196)

| measure | value |
|---|---|
| chisq | 23.17939228 |
| df | 13.00000000 |
| pvalue | 0.03957319 |
| cfi | 0.97483991 |
| tli | 0.95935677 |
| rmsea | 0.10217829 |
| srmr | 0.05047664 |

| PE row | param | est | se | ci.lower | ci.upper |
|---|---|---|---|---|---|
| 4 | dem60 =~ y1 | 1.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| 5 | dem60 =~ y2 | 1.43080264 | 0.21288198 | 1.01356163 | 1.84804366 |
| 6 | dem60 =~ y3 | 1.26713293 | 0.17905227 | 0.91619692 | 1.61806894 |
| 7 | dem60 =~ y4 | 1.56087813 | 0.18227220 | 1.20363117 | 1.91812508 |
| 8 | dem60 ~ ind60 | 1.39919513 | 0.36235071 | 0.68900080 | 2.10938947 |

### Cell 4: MLR / listwise (native lines 189-287, webr lines 197-295)

| measure | value |
|---|---|
| chisq | 23.53908699 |
| df | 13.00000000 |
| pvalue | 0.03564413 |
| cfi | 0.96436775 / cfi.scaled 0.96176528 / cfi.robust 0.96357043 |
| tli | 0.94244021 / tli.scaled 0.93823622 / tli.robust 0.94115223 |
| rmsea | 0.12486138 / rmsea.scaled 0.12714056 / rmsea.robust 0.12610480 |
| srmr | 0.05840425 |
| chisq.scaled | 23.92735147 |
| df.scaled | 13.00000000 |
| pvalue.scaled | 0.03180492 |

| PE row | param | est | se | ci.lower | ci.upper |
|---|---|---|---|---|---|
| 4 | dem60 =~ y1 | 1.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| 5 | dem60 =~ y2 | 1.26184933 | 0.13673386 | 0.99385590 | 1.52984277 |
| 6 | dem60 =~ y3 | 1.19007981 | 0.18861337 | 0.82040441 | 1.55975522 |
| 7 | dem60 =~ y4 | 1.26358143 | 0.16062049 | 0.94877106 | 1.57839180 |
| 8 | dem60 ~ ind60 | 1.49440497 | 0.43333980 | 0.64507456 | 2.34373538 |

### Cell 5: MLR / ml (FIML) (native lines 288-395, webr lines 296-403)

| measure | value |
|---|---|
| chisq | 22.15981477 |
| df | 13.00000000 |
| pvalue | 0.05293449 |
| cfi | 0.97593041 / cfi.scaled 0.97795885 / cfi.robust 0.96911658 |
| tli | 0.96111835 / tli.scaled 0.96439506 / tli.robust 0.95011140 |
| rmsea | 0.09692617 / rmsea.scaled 0.08918127 / rmsea.robust 0.11363986 |
| srmr | 0.03788058 |
| chisq.scaled | 20.75446590 |
| df.scaled | 13.00000000 |
| pvalue.scaled | 0.07792911 |

| PE row | param | est | se | ci.lower | ci.upper |
|---|---|---|---|---|---|
| 4 | dem60 =~ y1 | 1.00000000 | 0.00000000 | 1.00000000 | 1.00000000 |
| 5 | dem60 =~ y2 | 1.34451472 | 0.15912625 | 1.03263301 | 1.65639643 |
| 6 | dem60 =~ y3 | 1.18582369 | 0.15871113 | 0.87475559 | 1.49689179 |
| 7 | dem60 =~ y4 | 1.39169375 | 0.16848851 | 1.06146233 | 1.72192517 |
| 8 | dem60 ~ ind60 | 1.46283905 | 0.32574772 | 0.82438525 | 2.10129284 |

(Cross-engine parity note: 4 of the 7 known native-vs-WebR 1-ULP discrepancies fall in this
cell - see "Cross-engine parity" below for the full catalog and the pinning rule.)

### Cell 6: MLR / pairwise - FAILS (native line 396-397, webr line 404-405)

No fitMeasures/parameterEstimates output - `sem()` itself throws before returning a fit object.
See Q2 above for full root-cause analysis. The same `CELL FAILED: infinite or missing values
in 'x'` error text was captured under both native R and WebR.

### WLSMV / listwise and WLSMV / pairwise (byte-identical - see Q3)

(native lines 398-534 listwise / 535-671 pairwise; webr lines 406-542 listwise / 543-681
pairwise)

| measure | value |
|---|---|
| chisq | 4.14262150 |
| df | 17.00000000 |
| pvalue | NA |
| cfi | 1.00000000 / cfi.scaled 1.00000000 / cfi.robust NA |
| tli | 1.00468208 / tli.scaled 1.00311123 / tli.robust NA |
| rmsea | 0.00000000 / rmsea.scaled 0.00000000 / rmsea.robust NA |
| srmr | 0.01630698 |
| wrmr | 0.27198416 |
| chisq.scaled | 13.53275519 |
| df.scaled | 17.00000000 |
| pvalue.scaled | 0.69985589 |

| structural param | est | se |
|---|---|---|
| B ~ A | -0.59963804 | 0.99269563 |
| B ~ C | -0.30662034 | 0.76336148 |

## Cross-engine parity: seven 1-ULP discrepancies + pinning rule

Verified by a fresh aligned diff of the two committed captures
(`sed -n '3,671p' h1-spike-native.txt` vs `sed -n '11,679p' h1-spike-webr.txt` - stripping the
2-line lavaan banner and the 10-line Node harness preamble respectively, leaving two 669-line
bodies). The diff shows exactly SEVEN differing numeric values, every one an off-by-1 in the
8th decimal place (1-ULP at the printed precision, `1e-8` absolute):

| # | cell | value | native (line) | WebR (line) |
|---|---|---|---|---|
| 1 | Cell 2: ML / ml | PE row 14, `y3 ~~ y3`, ci.lower | 2.54844233 (125) | 2.54844234 (133) |
| 2 | Cell 4: MLR / listwise | PE row 13, `y2 ~~ y2`, ci.lower | 3.86266380 (283) | 3.86266379 (291) |
| 3 | Cell 4: MLR / listwise | PE row 17, `dem60 ~~ dem60`, se | 1.13991243 (287) | 1.13991244 (295) |
| 4 | Cell 5: MLR / ml | fitMeasures `baseline.chisq.scaled` | 372.81760191 (302) | 372.81760190 (310) |
| 5 | Cell 5: MLR / ml | fitMeasures `rfi.scaled` | 0.91007279 (318) | 0.91007280 (326) |
| 6 | Cell 5: MLR / ml | PE row 14, `y3 ~~ y3`, se | 0.94369102 (383) | 0.94369101 (391) |
| 7 | Cell 5: MLR / ml | PE row 15, `y4 ~~ y4`, se | 0.69581485 (384) | 0.69581486 (392) |

Line numbers are into the committed `scripts/spikes/h1-spike-native.txt` and
`scripts/spikes/h1-spike-webr.txt` respectively. All seven sit in cells 2, 4, and 5 - the three
cells whose fits involve either FIML (`missing="ml"`) or the MLR robust vcov, i.e. the most
iteration-heavy linear-algebra paths. Point estimates (`est` columns) never differ; the
discrepancies are confined to se/ci/derived-fit-index values. This is consistent with differing
BLAS/LAPACK backends (native R's macOS Accelerate framework vs WebR's WASM-compiled reference
BLAS) producing last-bit rounding differences in variance-covariance computations, not a
substantive algorithmic mismatch.

**Pinning rule for Tasks 4/5/10 (controller ruling)**: downstream tasks pin the NATIVE-derived
values (the tables in this doc) and compare WebR results with a tolerance equivalent to
`toBeCloseTo(value, 7)` - i.e. agreement to 7 decimal places - for ALL cells uniformly. Never
assert exact 8dp string equality across engines, and do not special-case the seven rows above:
the uniform 7dp tolerance covers them and any future backend-rounding drift alike. Exact
byte-equality between native and WebR outputs is not a property this spike establishes and must
not be assumed by any later task.

## Deviations from the brief's transcribed script (all mechanical, no numeric/model changes)

The brief's R script, run verbatim, does not execute to completion. Three mechanical fixes were
required; all are documented inline in `scripts/spikes/h1-estimator-spike.R` with DEVIATION
comments, and none change any estimator name, seed, model syntax, or numeric threshold from the
brief:

1. **`round()` on a `parameterEstimates()` subset errors.** `round(pe[, c("lhs","op","rhs",
   "est","se","ci.lower","ci.upper")], 8)` throws `Error in Math.data.frame(...) :
   non-numeric-alike variable(s) in data frame: lhs, op, rhs` in current R (the `Math` S3
   group generic for data.frame requires all-numeric columns; the brief's column subset keeps
   3 character id columns). Fixed by passing `nd = 8` straight to lavaan's own
   `print.lavaan.data.frame` method instead (see fix #2 below), which rounds only the numeric
   columns internally.
2. **`round(x, 8)` then default `print()` silently truncates back to 3 decimal places.**
   lavaan's `print.lavaan.vector` and `print.lavaan.data.frame` S3 methods (both used for
   `fitMeasures()` and `parameterEstimates()` output respectively) hardcode `nd = 3L` as their
   default argument (confirmed via `getS3method("print", "lavaan.vector")`) - this is
   independent of `round()` having already been applied upstream, and independent of
   `options(digits = ...)` (also tried and confirmed ineffective, since `nd` is a literal
   default, not tied to `getOption("digits")`). Fixed by calling `print(x, nd = 8)` directly
   (`print8()` helper in the script) instead of `print(round(x, 8))`.
3. **`MLR + missing="pairwise"` (cell 6) throws a hard, uncaught error**, which would abort the
   whole script before the WLSMV/Q3 section ever ran. This is a genuine Q2 finding (see above),
   not a bug to paper over - wrapped the `sem()` call for the 6-cell loop in
   `tryCatch(..., error = ...)` so the failure is captured and printed as `CELL FAILED: <msg>`
   and every other cell (including the entire WLSMV/Q3 section) still runs and gets captured.

The WebR twin (`h1-estimator-spike.node.mjs`) carries the same two `nd = 8` / `print8()` fixes
and the same `tryCatch` guard (both needed identically under WebR), plus one omission
documented inline: the twin's embedded R code skips the `write.csv()` fixture-writing lines,
since WebR's virtual filesystem in this Node harness has no `scripts/spikes/`/`docs/testing/`
directories and the fixtures are already pinned deterministically by the native run under the
same seed.

## Q5 harness note (WebR-in-Node specifics)

Following the precedent in `docs/superpowers/reviews/2026-06-18-sem-spike-data/webr-sem-spike.mjs`:
`shelter.captureR()`'s output channel throws `WebSocketServer is not a constructor` under this
Node setup, so the main estimator/missing matrix is run by writing the R code to WebR's virtual
FS, sourcing it with output `sink()`-ed to a file, then reading that file back
(`webR.FS.readFile`). The Q5 NaN check uses `webR.evalRVoid(code, { env })` directly (not
`captureR`) for the same reason, again sinking to a file - `evalRVoid` with an `env` binding
was verified to work cleanly in this Node harness (unlike `captureR`) via a standalone
derisking script before being folded into the twin. This mirrors exactly how the production
app binds JS values into R (`src/lib/webr/engine.ts`'s `runJson` uses `shelter.captureR(...,
{ env })` in the browser, and `capturePlot` uses `webr.evalRVoid(..., { env })` - the browser
does not hit the Node-specific `captureR` channel bug, so production is unaffected by this
harness-only workaround).

## Verdicts summary

- **Q1**: fitMeasures name sets pinned above (ML 46 / MLR 78 / WLSMV 70 names). `.robust` keys
  exist under WLSMV but are always NA - Task 5 must use `.scaled` for WLSMV, may prefer
  `.robust` (with `.scaled` fallback) for MLR.
- **Q2**: 5 of 6 cells run cleanly. `MLR + missing="pairwise"` hard-errors
  (`eigen(): infinite or missing values`) - not fixture-specific, root-caused to lavaan's own
  documented scoping of `"pairwise"` to the (W)LS family. Production dropdown must guard this
  combination.
- **Q3**: WLSMV fits cleanly with mixed ordered+continuous indicators for both listwise and
  pairwise. The two are byte-identical because the brief's fixture carries no actual missing
  data - flagged as a coverage gap for whichever task adds WLSMV+missingness test coverage.
- **Q4**: confirmed from lavaan source - non-bootstrap CIs are `est +/- qnorm(alpha) * se`
  (Wald/delta-method), regardless of which `se` (standard/robust.huber.white/robust.sem) feeds
  the formula.
- **Q5**: confirmed - a JS `NaN` in a `webR.evalRVoid(code, { env })`-bound array arrives in R
  as `is.na() == TRUE`, using the same marshalling mechanism the production app uses.
- **Cross-engine parity**: seven 1-ULP (1e-8) native-vs-WebR discrepancies cataloged above
  (cells 2, 4, 5; se/ci/derived-index values only, never point estimates). Ruled: downstream
  tasks pin native values and compare WebR with a uniform 7dp tolerance
  (`toBeCloseTo(value, 7)`); never exact 8dp string equality across engines.

**Gate status: PASS.** No spike question was unanswerable and no cell silently misbehaved -
every failure (MLR/pairwise) was caught, root-caused, corroborated on an independent dataset,
and is a legitimate finding for the production wiring to guard against, not a spike
infrastructure problem. The cross-engine tolerance question is settled by the controller ruling
above (uniform 7dp), so no open items remain for the downstream tasks.
