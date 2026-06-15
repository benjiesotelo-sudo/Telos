# Econometrics family — ratify list (both sub-slices)

**For Benjie's click-through gate.** The full econometrics family is built to green on local `main`
(`0d61fa0`, 18 ahead of `origin`, **nothing pushed/deployed**). 11 tests live: 4 time series + 7 panel/causal
→ **40 of 47 tests live**. Every statistic was cross-checked **WebR ≡ native R 4.6.0**. Nothing here is a
blocker; these are the calls I made under autonomy for you to ratify, plus open forks that are yours.

**Verification done:** per-test stats tests assert native-R ground truth (committed spike reports); 11 new
card-consistency tests assert the registries are **verbatim-faithful to the drawn HTML cards**; 2 e2e journeys
(panel + causal) drive the real app end-to-end; gates: tsc 0 · vitest 757/757 · e2e green · fresh-clone (final
gate running at hand-off). **Note:** the planned *separate adversarial opus review* was substituted by this
layered verification — say the word if you want a dedicated review pass.

---

## A. Sub-slice 1 — Time series (ARIMA/SARIMA, Stationarity, Granger, VAR)

Carried from that slice (not yet explicitly ratified):
1. **Report-only APA** on all 4 cards (registry + `telos_test_outputs.html` mirror) — neutral wording, no verdicts.
2. **Stationarity "Conclusion" column kept** — computed from each test's actual p vs α (reports the test's own
   decision, not a verdict on your hypothesis). Borderline vs report-only — your call.
3. **Preload growth accepted** (forecast, tseries, urca, vars, lmtest).
4. **Built both ARIMA auto + manual order** (six inline steppers when "manual").
5. **§2.5 econometrics-grade card EXPANSIONS beyond the drawn HTML** (registry + consistency tests carry them;
   HTML *structural* sync deferred to you, since the cards are your design canvas): **ARIMA residual-diagnostics
   figure**; stationarity **Phillips–Perron** 3rd row; **VAR FEVD table + stability note**.
6. **Fixes the review caught:** eligibility `'values'` minRule now checks *all* role candidate sets (`bc5f985`
   — was `candidates[0]`-only, so time-series tests were wrongly greyed; the e2e caught it); **VAR lag-selection
   BIC/HQ columns were swapped** (`f155b1a`, `VARselect` rows AIC/HQ/SC); stationarity APA bounded-p.
7. **Open (yours):** VAR auto-lag picks **p=9** on the 72-row fixture (a near-unit-root knife-edge — faithful to
   native R, but a tighter `lag.max` default for short series is worth a ruling); FEVD is **Cholesky-ordering
   dependent** (a how-to-read disclosure could note it); the stationarity `test`/`lags` and VAR `lag order`
   selectors are currently **cosmetic** (the runner always computes the full set; the manual-lag path is dead).

---

## B. Sub-slice 2 — Panel + cross-sectional causal (FE, RE, Hausman, DiD, IV, RDD, PSM)

### Decisions I made (ratify):
1. **Report-only APA neutralisation** (registry + HTML mirror): **Hausman** "favoured fixed effects" →
   *"A Hausman test comparing the fixed- and random-effects estimates gave χ²(…)=…, p …"*; **PSM** dropped the
   *"(all SMDs < .1)"* balance claim (balance is reported in the table); **IV** *"X had an effect of B"* →
   *"The 2SLS estimate for X was B"*. These were the audit's M1-class verdict bug, in the drawn cards.
2. **New backbone:** an **`entity` role** (nominal/ordinal) + a **`panel` minRule** (≥2 entities, ≥2 periods,
   ≥12 complete obs) for FE/RE/Hausman.
3. **Clustered/robust SEs — drawn, so built:** `plm::vcovHC` (Arellano) for FE/RE; `sandwich::vcovCL`
   (cluster by entity) for DiD; `sandwich::vcovHC` (robust) for IV. All reproduce native R under WebR.
4. **CI fixed at 95%; α adjustable only where the card draws it** (FE/RE/Hausman/DiD/IV draw α; **RDD/PSM draw
   no α pill**). **No card draws a CI pill**, so I did *not* add one — matching the drawn cards exactly, per the
   precedent you ratified for sub-slice 1. *(This refines the spec's earlier "adjustable α+CI uniformly", which
   didn't match what the cards actually draw.)*
5. **Hausman Decision** computed from p vs α (on the fixture: p=.381 → **RE**). Borderline vs report-only,
   same posture as the stationarity Conclusion column.
6. **DiD = base `lm(y ~ treated*post)`** + clustered SE (the `did` package isn't WebR-loadable and isn't needed
   for the 2×2); **no covariate slot in v1** (the card draws "covariates: none" as a display pill).
7. **IV via `ivreg`**; weak-instrument test shipped **always-on** (display).
8. **RDD:** `cutoff` interactive (default 50); **bandwidth = rdrobust auto** (display); polynomial 1·linear / 2·quadratic.
9. **§2.8 econometrics-grade additions BUILT:** IV diagnostics **surfaced** (weak-IV F, Wu–Hausman, Sargan) +
   **FE poolability F-test** (a builder-constructed note — the FE card has no drawn note).
10. **PSM:** matching method = **nearest only** (optimal/full need `optmatch`, not WebR-shipped → shipped as a
    display "nearest"); covariates **numeric-only** in v1 (card display reads "any level"); **hand-rolled
    ggplot love plot** (cobalt is unavailable under WebR).
11. **Fixtures (your external-review deliverable):** two new committed, native-R-verified files — **`panel.csv`**
    (12 firms × 8 yrs) + **`causal.csv`** (200 rows, a clean separate outcome per method). **`wage1-extended.csv`
    left UNCHANGED** — a refinement from the spec's original "extend wage1": a clean purpose-built `causal.csv`
    demonstrates IV/RDD/PSM far better than bolting synthetic columns onto real wage data, and protects the 29
    existing tests' outcome. Both copied to `~/Documents/` and fully documented in `test-config-guide.md`
    (tests 34–40, with the required configure-data flips).
12. **Build deviation the e2e caught + fixed:** DiD table id `did-model`→`did` so the export emits the
    card-faithful `table_did.png`; the zip numbers folders in *checkbox-selection* order.

### Open forks (yours — none block anything):
- **DiD formal pre-trend test** and **RDD McCrary density / covariate-placebo checks** — deliberately NOT built
  (the DiD card frames parallel-trends as visual/"not confirmatory"; the RDD diagnostic packages weren't spiked).
  These are the only places the cards stop short of the very fullest econometrics-grade bar.
- **IV weak-instrument test + RDD bandwidth** are display-only — make them interactive if you want.
- **PSM optimal/full matching** (needs `optmatch`) and **nominal covariates** are deferred.
- **Hausman favours RE** on this fixture (a valid result). If you'd rather the teaching demo favour FE, the
  fixture's firm-effect↔regressor correlation can be tuned.
- **App-wide bar:** econometrics is now publication-grade (your option 3); the basic families remain
  teaching-grade. The regression-completeness bar revisit you flagged is still open.

---

## Push / deploy
Both are your calls — **nothing has been pushed or deployed.** After your ratify rulings, the natural next
slice per ROADMAP is **Latent variables & SEM**.
