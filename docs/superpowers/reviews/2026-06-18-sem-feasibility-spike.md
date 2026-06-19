# SEM feasibility spike — WebR 0.6.0 ≡ native R 4.6.0

> **2026-06-18.** De-risking the "Latent variables & SEM" slice before spec/plan: do the SEM R packages load + run under WebR (in-browser), and do they reproduce native R? Method mirrors prior slices — the SAME R script (`sem-spike.data/sem-spike.R`) run under both native `Rscript` and WebR, on each package's built-in datasets (HolzingerSwineford1939, PoliticalDemocracy, seminr `mobi`), then diffed. Harness + raw outputs in `2026-06-18-sem-spike-data/` (`sem-spike.R`, `webr-sem-spike.test.ts` [the working vitest harness], `native-output.txt`, `webr-output.txt`).

## Verdict: GREEN — the SEM stack is feasible in WebR, with three concrete adaptations.

All five packages install + load under WebR 0.6.0, and **every deterministic statistic matches native R 4.6.0 exactly**; lavaan's serial bootstrap CIs match to the digit; the seminr PLS bootstrap matches exactly too. Three adaptations are required (all have precedent in this codebase), and one performance reality needs an owner decision.

## 1. Package availability + load (the make-or-break risk)

| Package | WebR load | Version (WebR / native) | Install time (WebR, cached repo) |
|---|---|---|---|
| **lavaan** (CB-SEM/CFA/path) | ✅ | 0.6.21 / 0.6.21 | ~2–4s (incl. Fortran deps: pbivnorm, mnormt, …) |
| **semTools** (ω, CR, AVE, HTMT, invariance) | ✅ | 0.5-8 / 0.5-8 | ~0.6–2.7s |
| **psych** (EFA, PCA, α, ω) | ✅ | 2.6.5 / 2.6.3 | ~1.3s |
| **GPArotation** (oblimin) | ✅ | 2026.4.1 / 2026.4.1 | ~0.3s |
| **seminr** (PLS-SEM) | ✅ | 2.5.0 / 2.5.0 | ~14–44s (heaviest; varies) |

First-run init (download R runtime + all five) ≈ **50–55s** in Node; the browser caches after first visit (same as the existing 25-package engine). psych is 2.6.5 in the WebR repo vs 2.6.3 native — a patch bump; results were identical regardless.

## 2. Parity — WebR vs native R, per card

A targeted numeric diff of all reported statistics returned **no differences** (the only divergence is cosmetic factor-column labelling, item 3 below).

| Card / output | Match | Notes |
|---|---|---|
| **CFA** (fit χ²/df/p/CFI/TLI/RMSEA+90%CI/SRMR; std. loadings + SE/z/p) | ✅ exact | χ²=85.305, CFI=.931, RMSEA=.092 [.071,.114], SRMR=.065; loadings identical |
| **Reliability/validity** — `compRelSEM` ω + α, `AVE`, `htmt` | ✅ exact | ω=.612/.885/.686; α=.626/.883/.689; AVE=.371/.721/.424; HTMT matrix identical |
| **Reliability** — `psych::alpha`, `psych::omega` | ✅ exact | α=.626; ω_h=.384, ω_tot=.840 |
| **EFA** — KMO, Bartlett, pattern loadings, communalities, Φ | ✅ values exact | KMO=.752; Bartlett χ²=904.1; loadings & communalities identical. **⚠️ factor COLUMN order/labels differ** (native PA1/PA3/PA2 vs WebR PA1/PA2/PA3 — see item 4) |
| **PCA** — eigenvalues, cumulative %, loadings | ✅ exact | eigenvalues 3.216/1.639/1.365/…; loadings identical |
| **CB-SEM + mediation** — fit, structural paths, indirect/total **bootstrap CIs** | ✅ exact | indirect=1.274 SE=.343 boot95% [.564,1.936]; total=1.727 [.962,2.536] — lavaan serial bootstrap + `set.seed` is bit-reproducible across WebR/native (shared Mersenne-Twister) |
| **Path analysis (observed-only)** — df=0 saturation + indirect bootstrap CI | ✅ exact | **df=0, χ²=0, CFI=1, RMSEA=0 confirmed**; indirect=0.698 [.278,1.002] identical |
| **PLS-SEM** — outer loadings, α/ρ_A/ρ_C/AVE, HTMT, R²/adjR², **bootstrap paths** | ✅ exact | all reliability/validity/R² identical; bootstrapped β/SE/t/CI/p identical to native |

## 3. Required adaptations for the build (all have in-repo precedent)

**(a) `parallel::makeCluster` shim — REQUIRED.** WebR/WASM has no sockets, so any PSOCK cluster throws `WebSocketServer is not a constructor` (an Emscripten `___syscall_listen`). **`seminr::bootstrap_model` ALWAYS builds a cluster** (`setup_parallel_cluster` calls `makeCluster(n_cores)` with no serial path, even at `cores=1`). Fix = shim `parallel::makeCluster`/`makePSOCKcluster`/`parLapply`/`clusterExport`/`clusterEvalQ`/`stopCluster`/`clusterSetRNGStream` to run **serially**, added to `Engine.init` right beside the existing `detectCores` shim. Verified: with the shim, seminr bootstrap runs to completion and matches native exactly. (lavaan's bootstrap defaults to `parallel="no"` → no shim needed there.)

**(b) Parallel analysis must be hand-rolled — `psych::fa.parallel` does NOT run under WebR.** It produced no output in WebR (errored, swallowed by the spike's tryCatch) — it uses `mclapply` + a simulation/plot path that fails in WASM. Since the convention recommends parallel analysis as the factor-retention rule (EFA + PCA), we hand-roll it: simulate/resample random eigenvalues and compare to observed (a ~15-line R loop). Same precedent as the hand-rolled Nemenyi (Friedman) and PSM love-plot. (`psych::fa`, `KMO`, `cortest.bartlett`, `principal` all work fine.)

**(c) Deterministic factor ordering — REQUIRED for display stability.** EFA factor columns came back labelled in a different order under WebR vs native (PA1/PA2/PA3 vs PA1/PA3/PA2) — the loadings are identical, only the arbitrary factor labels/order differ (psych 2.6.5 vs 2.6.3). The builder must **sort factors deterministically** (e.g., by sum-of-squared-loadings / variance explained) before rendering, so the table is stable regardless of psych's internal ordering. Applies to EFA and PCA loading tables.

## 4. Performance (the UX-relevant numbers, and one decision)

| Operation | native | WebR | WASM penalty |
|---|---|---|---|
| CFA fit (no bootstrap) | <1s | <1s | negligible |
| CB-SEM mediation, bootstrap=200 | 1.8s | 6.4s | ~3.5× |
| PLS-SEM, bootstrap=200 | 2.5s | 20.1s | ~8× (serial shim = no parallelism) |

**Extrapolation to the approved bootstrap counts:** PLS at the ruled **10,000 resamples ≈ ~17 minutes** in WASM (20.1s × 50); CB-SEM mediation at **5,000 ≈ ~2.7 minutes** (6.4s × 25). Both are single-threaded in WebR (the shim removes parallelism by necessity).

**Implication / decision for the owner:** this validates the §6C "one step at a time + chunked bootstrap + progress" requirement — it's mandatory, not optional. But a 17-minute in-browser PLS run is a poor default. Options: (i) keep 10k only as an opt-in "final reporting" toggle with a clear time warning, default to a faster count (e.g., 1,000–2,000) for interactive use; (ii) chunk with a live progress bar + cancel; (iii) accept the wait. **This touches the §4f ruling (PLS bootstrap = 10,000)** — recommend revisiting it in light of the WASM cost. My recommendation: default 2,000 with progress, 10,000 as an explicit "final run" option that warns it may take ~15+ min.

## 5. Confirmed correctness facts (bankable for the build)

- **Saturated path models are detectable and must suppress fit** — `fitMeasures(fit,'df')==0` ⇒ χ²=0/CFI=1/RMSEA=0 (mathematically forced). The canonical single-mediator X→M→Y chain is exactly df=0, confirmed. The df-gate (convention §7A) is real and trivial to implement.
- **lavaan serial bootstrap is reproducible across WebR/native** with `set.seed` — so the native-R `runs-in-r` parity gate will hold for CB-SEM/path mediation CIs.
- **`compRelSEM` returns a verbose per-factor list**, not a numeric vector — builders must `unlist()`/extract (noted so we don't trip on it again). `AVE`/`htmt` return clean numeric/matrix.

## 6. Not yet tested (flag for the spec, low risk)

- **`semboottools::standardizedSolution_boot`** (standardized indirect-effect bootstrap CIs, convention §7B) — not on CRAN as a macOS binary here; check its WebR availability during the build, else hand-roll standardized bootstrap CIs (we already have the bootstrap machinery).
- **`semPlot::semPaths`** (R-rendered path diagram) — not tested; heavy `qgraph` deps. Likely we render the path diagram in-app on the AMOS canvas anyway (it's the input surface), so an R diagram may be unnecessary; decide in the spec.
- **Multigroup** (`measEq.syntax`, cSEM `testMICOM`/`testMGD`) — deferred slice; not tested here.

## Bottom line

The SEM slice is **technically feasible in WebR with no blockers** — all packages load, all numbers match native R, the df=0 rule works, and the parity gate will hold. The build needs three known adaptations (parallel shim, hand-rolled parallel analysis, deterministic factor ordering) and a decision on the PLS bootstrap default given the ~17-min WASM cost at 10k. Ready for spec → plan on the owner's word.
