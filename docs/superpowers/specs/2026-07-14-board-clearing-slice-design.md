# Board-clearing slice - design

**Status:** every item owner-ruled explicitly (D1-D7 confirmed 2026-07-13; wiring-inspection verdicts + moderation-figure and figure-colors rulings 2026-07-13/14). No open design decisions remain; this spec consolidates them for the build.
**Goal:** clear every fixable item off the agenda in one gated slice, so the owner starts his next project with only the parked epic and the November JOSS date remaining.

## Owner rulings this slice executes (verbatim ledger)

- **R1 (D1/H2):** WIRE the CB-SEM EFA pipeline stage - when EFA is selected, Tables E1 (suitability: KMO, Bartlett) and E2 (loadings) render, exactly as the card note already promises. The runner already computes both; only the builder rendering is missing. Note text stays.
- **R2 (inspection b):** WIRE the CI pill on simple-linear-regression, logistic-regression, poisson-negative-binomial, factorial-anova - the emitters pass the chosen level into every CI-bearing R call (modelsummary conf_level, effectsize ci=, confint level, parameters ci=), following multipleLinearRegression's existing correct pattern. App is already correct; this is an export-parity fix. Native-R pins re-verified per test.
- **R3 (inspection c):** WIRE the stationarity `test` selector - 'ADF only' / 'KPSS only' / 'both · ADF + KPSS' genuinely subsets which tests the app reports AND the script runs/prints. (PP accompanies 'both' as today; disclosure line names what ran.)
- **R4:** the classic two-line (Aiken-West) interaction chart REPLACES the whisker simple-slopes figure as the moderation figure on CB-SEM and PLS-SEM (app + export + report.tex). The conditional-effects table (with CIs) stays. Figure colors: R-package defaults - the owner explicitly cancelled any recoloring (2026-07-13); draw the chart with default styling.
- **R5:** the latent-interaction product-indicator group in the CB-SEM measurement table gets a real label (e.g. `CS×PS (product indicators)`), never `null`.
- **R6 (PLS audit):** PLS-SEM card completed against Hair et al. (2019): add f² effect sizes and inner-model VIF if absent; verify the PLSpredict/Q² presentation; add a short "which tradition, when" explainer note to BOTH SEM cards (CB = confirmatory/global-fit tradition; PLS = prediction/composite tradition - the reason PLS legitimately shows no fit-index table).
- **R7 (D2):** WLSMV auto-fallback - when a canvas edit breaks WLSMV's enabling condition, the stored estimator resets to 'ML' with a visible hint (same discipline as syncLevelSelect).
- **R8 (D3):** the exogenous-ordinal disclosure also renders on saturated (df=0) path models.
- **R9 (D4):** latent-canvas auto-layout + auto-Fit: on construct add, nodes take the diamond arrangement (exogenous left, mediators center, endogenous right, moderation-only constructs low) and the viewBox auto-Fits; any manual drag still overrides and persists. Path-mode canvas unchanged (its grid already auto-fits).
- **R10 (D5):** catalog short label 'Mult. regression' becomes 'Multiple regression'; the APA em-dash empty-cell sentinel in tables is KEPT (owner-confirmed convention).
- **R11 (D6):** combined correlation matrix table added to the CB-SEM card (construct correlations, √AVE italic on the diagonal, Mean/SD columns appended - Huang Table 3 arrangement). Fornell-Larcker and HTMT tables stay unchanged.
- **R12:** latent-rename gap - renameColumn also remaps `constructs[].items` (the path-mode `placed`/`nodePositions` remap already exists; this closes the latent half).
- **R13 (hygiene tickets):** pathAnalysis registry consistency pins (spec-twin style) + the isEndogenous/indicatorLevels/exogenousOrdinals block extracted into one shared helper used by runner and emitter.
- **R14:** C1 phone bug - theme-select no longer overlaps the compact rail on phones.
- **R15:** pre-commit path guard hook - blocks commits that touch the owner's untracked personal docs pattern (the two prior sweep incidents' class).
- **R16:** `scripts/wiring-sweep.mts` graduates into a committed, permanent gate (vitest or CI step) with its false-positive ledger encoded (alpha/reportOR/standardize/nFactors classes annotated as honest) so only NEW suspects fail.
- **R17 (docs for the auditors):** after all fixes gate green, regenerate the affected per-test documentation pages (at minimum: 26 simple-linear, 28 logistic, 29 poisson, 08 factorial, 31 stationarity, 46 cb-sem, 47 pls-sem) + the doc index, via the existing harness, so the faculty audit reviews current truth. Pages deployment carries them on push.

## Out of scope (owner-ruled parking)

Second-order constructs (later patch), multi-dataset epic (post-project), JOSS (November), figure recoloring (cancelled outright).

## Acceptance

tsc clean · test:fast + full WebR vitest green · wiring sweep reports ZERO unexplained suspects · native-R parity re-verified for every touched emitter (R2, R3, R4) · full 5-project Playwright green (canvas auto-layout changes SEM visual baselines - regenerate with owner diff set) · fresh clone · docs regenerated (R17) · ratify doc with the usual held/notes sections · owner click-through -> his push word -> deploy + Pages.
