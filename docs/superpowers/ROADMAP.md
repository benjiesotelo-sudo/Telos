# Telos build roadmap

**Authority:** the tech stack and architecture are locked in `specs/2026-06-10-telos-architecture-design.md`;
product content is locked in the three root spec HTML files. This file only tracks slice order and status.
Each slice gets its own design spec + implementation plan here when it starts. Session estimates are rough.

## Done

| Slice | Landed | Docs |
|---|---|---|
| Walking skeleton — independent t-test end-to-end | 2026-06-11 | `plans/2026-06-10-telos-walking-skeleton.md` |
| Frontend flow — full 7-step shell, 46-test picker, export bar | 2026-06-11 | `specs+plans/2026-06-11-telos-frontend-flow*` |
| Core tests 1 — 8 tests live (descriptives, t-family, Mann-Whitney, Wilcoxon), multi-test sessions | 2026-06-12 | `specs+plans/2026-06-11-telos-core-tests-1*` |
| Overnight QA — multi-variable normality (owner-authorized card change), Next button, theme toggle, 7 audit fixes | 2026-06-12 | this file's history; findings in the session record |
| ANOVA family — 11 tests live (one-way, factorial, RM, **Mixed (new card, owner-ruled 1B×1W)**, nested, Welch's, ANCOVA, MANOVA, MANCOVA, Kruskal-Wallis, Friedman); shared post-hoc/sphericity/adjusted-means backbone; select option kind | 2026-06-12 | `specs+plans/2026-06-12-telos-anova-family*`, spike `reviews/2026-06-12-anova-spike-report.md` |
| Association — 6 tests live (Pearson, Spearman, Kendall's tau, χ² independence, χ² goodness-of-fit incl. **custom expected proportions (owner-ruled R1)**, Fisher's exact); proportions option kind; grouped-bar figure + hand-V spec amendments (R2/D1) | 2026-06-12 | `specs+plans/2026-06-12-telos-association-family*`, spike `reviews/2026-06-12-association-spike-report.md` |
| Regression & prediction — 4 tests live (simple linear, multiple linear, logistic incl. event-category level-select (B2), Poisson/negative binomial incl. count-tag gate (B1) + exposure offset); pROC/parameters/performance preloaded | 2026-06-13 | `specs+plans/2026-06-12-telos-regression-family*`, spike `reviews/2026-06-12-regression-spike-report.md` |
| Dogfood audit + report-only policy + adjustable α/CI — 57 verified audit findings fixed (0 blockers/6 majors/38 minors/13 polish); **neutral report-only APA** across all 47 cards (registries + spec HTML) — outputs report the numbers, never declare a verdict; the "how to read" layer does the general teaching; fpApa/f01 APA-sentence formatters; per-test value fixes (Welch Games-Howell sign, logistic/Poisson "0.00" rounding, factorial wrong-row + main-effects branch, RM/one-way/nested/mixed labels, note anchoring, sticky clearance); **α (reference) + CI (threaded into R, 90/95/99) now adjustable** (defaults 0.05/95%). No new live tests (still 29/47). | 2026-06-13 | `reviews/2026-06-13-dogfood-audit.md`, `reviews/2026-06-13-design-theme-menu.md`, `plans/2026-06-13-audit-fixes-and-report-policy.md` |
| Econometrics — 11 tests live (time series: ARIMA/SARIMA, stationarity ADF/KPSS/**PP**, Granger, VAR + §2.5 econometrics-grade extras [ARIMA residual diagnostics, VAR FEVD + stability]; panel: **fixed effects, random effects, Hausman, DiD**; cross-sectional causal: **IV/2SLS, RDD, PSM**); new `time` + `entity` roles + `panel` minRule; plm/sandwich/ivreg/rdrobust/MatchIt preloaded; every statistic WebR ≡ native R 4.6.0; report-only APA (Hausman/IV/PSM verdicts neutralised); hand-rolled PSM love plot (cobalt absent); new `panel.csv` + `causal.csv` testing fixtures + guide | 2026-06-15 | `specs+plans/2026-06-15-telos-econometrics-{timeseries,panel-causal}*`, spikes `reviews/2026-06-15-econometrics-spike.md` + `reviews/2026-06-15-panel-causal-spike.md` |
| **modelsummary table format** — all 13 regression/econometrics coefficient tables restyled to the publication convention (stacked estimate / (SE) / [CI] → GOF footer → side-by-side model columns, **no stars**, report-only); 5 side-by-side built (logistic B\|OR, Poisson B\|IRR, Hausman FE\|RE, IV OLS\|2SLS, VAR per-equation); **DiD swapped to entity-FE (Option B)**; new `TableSpec.kind:'coef'` backbone + `ApaTable` stacked renderer; GOF rows per family (lm/glm full; plm/ivreg/rdrobust/matchit per native-R); every value native-R verified; no new live tests (still 40/47) | 2026-06-16 | `specs+plans/2026-06-16-telos-modelsummary-table-format*`, spike+review `reviews/2026-06-16-modelsummary-format-{spike,review}.md` |

## Remaining (in order)

| # | Slice | Tests / scope | Est. sessions | Risk notes |
|---|---|---|---|---|
| 1 | Report & export (**moved ahead of SEM, owner 2026-06-17**) | R script (all 40, clean idiomatic + cleaned.csv) · PDF (browser print) · LaTeX (native booktabs) · LICENSES in bundle | ~2–3 | **large**: R + LaTeX emitters touch every test type; client-side PDF via print. Specced `2026-06-17-telos-export-formats-design.md` |
| 2 | Latent variables & SEM | ~7: alpha, AVE/CR, EFA, PCA, CB-SEM, PLS-SEM, mediation (R1) | ~2–3 | AMOS-style canvas = new UI surface; full review gauntlet per owner ruling |
| 3 | Polish & launch | design pass, DRAFT copy confirmations, B-list, feedback URL, analytics, licence, a11y, deploy | ~1 | mostly owner decisions |

## Process per slice (owner-ruled 2026-06-12, replaces the full gauntlet)

- **Keep:** pre-plan statistical spike (known answers cross-verified WebR ≡ native R) · card-scoped
  consistency tests + mutation checks · full gates every commit · owner click-through at slice end.
- **Drop:** full-plan sandbox replay (spot-validate novel machinery only) · per-task reviews for
  pattern-following tests (one combined slice-end review) · multi-agent plan authoring.
- **Parallel:** per-test implementers in isolated worktrees touching only their own new files;
  one serial integration task registers catalog/builders; full suite gates once at integration.
- SEM/report slices keep the full gauntlet.
