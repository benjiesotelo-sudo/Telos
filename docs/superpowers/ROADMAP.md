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

## Remaining (in order)

| # | Slice | Tests / scope | Est. sessions | Risk notes |
|---|---|---|---|---|
| 1 | Association | ~6: Pearson, Spearman, Kendall, χ² ×2, Fisher | ~0.5 | most pattern-following slice |
| 2 | Regression & prediction | ~4: simple, multiple, logistic, Poisson/neg-bin | ~1 | bigger output tables |
| 3 | Econometrics | ~11: ARIMA, ADF/KPSS, Granger, VAR, FE/RE, Hausman, DiD, RDD, IV, PSM | ~1.5–2 | **main risk: package availability under WebR** — spike first |
| 4 | Latent variables & SEM | ~7: alpha, AVE/CR, EFA, PCA, CB-SEM, PLS-SEM, mediation (R1) | ~2–3 | AMOS-style canvas = new UI surface; full review gauntlet per owner ruling |
| 5 | Report & export | PDF report, LaTeX, R script, LICENSES in bundle | ~1–2 | client-side APA-7 PDF generation |
| 6 | Polish & launch | design pass, DRAFT copy confirmations, B-list, feedback URL, analytics, licence, a11y, deploy | ~1 | mostly owner decisions |

## Process per slice (owner-ruled 2026-06-12, replaces the full gauntlet)

- **Keep:** pre-plan statistical spike (known answers cross-verified WebR ≡ native R) · card-scoped
  consistency tests + mutation checks · full gates every commit · owner click-through at slice end.
- **Drop:** full-plan sandbox replay (spot-validate novel machinery only) · per-task reviews for
  pattern-following tests (one combined slice-end review) · multi-agent plan authoring.
- **Parallel:** per-test implementers in isolated worktrees touching only their own new files;
  one serial integration task registers catalog/builders; full suite gates once at integration.
- SEM/report slices keep the full gauntlet.
