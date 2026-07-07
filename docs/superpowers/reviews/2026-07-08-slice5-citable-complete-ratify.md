# Slice 5 "Citable & Complete" - Build Ratify

Date: 2026-07-08.
Spec `2026-07-06-telos-citable-complete-design.md` (adversarially reviewed, amended) · plan `2026-07-06-telos-citable-complete.md` (56 tasks, 12 units, self-review fixed) · ledger `.superpowers/sdd/progress.md` · audit `2026-07-06-completeness-audit.md`.
Local main only - NOT pushed, NOT deployed. Your word, as always.

## Gate (full, at the pre-fix-wave HEAD; fix wave re-verified targeted + runs-in-r + test:fast + desktop/visual)

- tsc -b --force clean · build clean.
- test:fast 1460/1460.
- FULL WebR vitest 1713/1713 (211 files, 0 skipped) including runs-in-r 31/31 on native R 4.6.0.
- Playwright 38/38 across all five projects (desktop 21 · mobile 1 · tablet 1 · responsive 9 · visual 6).
- Fresh clone: npm ci + test:fast + build green.
- LaTeX: standing tectonic compile-smoke test over all four A6 table devices (new); the doc regen also compiled all 48 reports via tectonic.

## What shipped (your A1-A7 + P1 + R1 + F1 + X1, all boards honored)

- **A6 craft**: grouped rows, spanned headers, section labels, starred/italic matrices - in HTML, PNG capture, LaTeX, PDF.
- **CB-SEM card**: one grouped measurement table (ω AND α + CR/AVE on construct rows; item Mean/SD/B/SE/z/p/loading), fit table, on-card Fornell-Larcker (starred) + HTMT with your cross-reference note, the H-numbered hypothesis table with percentile + BC CIs under spanned headers and derived Supported verdicts, E1/E2 EFA preamble labels, labelled notes.
- **Latent moderation (A7)**: draw a moderator onto a path; indProd double-mean-centered interaction (matched or all-products with disclosure), := simple slopes with bootstrap CIs, whiskered slopes figure (facets for 2+ moderations), conditional-effects table, dashed arrow with live β - all reproduced by the exported analysis.R and verified against native R to 8 decimals.
- **PLS parity (P1)**: grouped measurement (α/ρA/CR/AVE + M/SD), HTMT on-card, dual-CI hypothesis table (hand-rolled bias-corrected CIs proven equal to lavaan's bca.simple to 6dp), interaction_term moderation, slopes figure, full export parity.
- **Citations (A4)**: 48-entry registry (provenance-audited - zero fabricated references; several REAL miscitations found and fixed, incl. one from our own plan: Welch 1951 vs 1947), "Why this test" at config, "Statistical basis" on every results card, LaTeX/PDF included, CITATIONS.txt generated from the same registry.
- **Term-led explainers (A5, your R² format)**: all 48 cards, values injected from the live run, machine-checked coverage (every statistic column must have an explainer - a standing test).
- **Completeness (R1)**: 48-card audit committed; 44 STANDARD gaps fixed (verdict sentences on every parametric assumption check, Welch ω², multivariate partial η², MLR β CIs, logistic accuracy/sensitivity/specificity + AUC CI, exact-vs-asymptotic disclosures, Friedman N, DiD 2×2, RDD bandwidth sensitivity, IV first-stage per endogenous, and more - every new statistic native-R-verified).
- **Readability (F1)**: welcome/guide restructured (derived from your byte-pinned copy - constants untouched).
- **Spaced names (X1)**: 'customer satisfaction q1'-style headers work app AND export, multi-test-safe.
- **Bonus fixes along the way**: your SemCanvas export-fit work landed properly (U0); the display-option default seam; honest CIs on non-bootstrapped runs; multi-moderation crash prevented; canvas midpoint occlusion (skip-paths were unclickable); doc-harness scroll workaround.

## DECISIONS HELD FOR YOU (nothing built - your rulings)

**H1 (top of list): the estimator and missing-data dropdowns are display-only.** They have NEVER been wired into the lavaan fit (always ML + listwise). The UI now honestly shows the effective default, but the card note still says "Use WLSMV for ordinal indicators" and the rMap advertises estimator choices. Ruling needed: wire them (a stats change, native-verified) or remove the dropdowns. A supervisor would catch this - recommend resolving before first deploy.
**H2: CB-SEM's EFA pipeline stage is dead code** - the runner computes EFA tables, the builder never renders them, yet notes promise them. Wire or remove.
H3-H12 (full detail in the audit doc): one-way ANOVA post-hoc APA sentence ends in an ellipsis (enumeration ruling); η²/ω²-family CI sidedness labeling (one-sided pinned-1.00 under a "95% CI" header - Steiger convention question); paired-t SE/descriptives parity rulings; regression graphical-vs-formal assumption checks; stationarity test-select wiring; Granger stationarity pre-test; FE serial-correlation diagnostic; econ display-only sweep; Hausman robust variant; Q² label (recorded resolved: current label kept, closes 2026-06-21 ratify item 3).

## Notes for your click-through

- N1: Visual baselines changed for welcome/guide (readability) and test-config (Why-this-test line) - 18 of 30 regenerated; before/after diffs organized for you at `.superpowers/sdd/baseline-diffs/`.
- N2: App UX finding from the doc sweep: scroll position persists across step navigation, so after scrolling on Pick tests the sticky rail can cover the first config slot. Recommend a scroll-to-top on step change (small fix, your call).
- N3: Construct-slots config screens say "Drag columns into roles" though they have no drag roles (copy quirk).
- N4: nested-ANOVA's ω² benchmarks are imported from the one-way η² convention (defensible, flagged for transparency).
- N5: Rosseel (2012) appears in both the R-packages section and the statistical basis with different URLs (CRAN vs DOI) - dedup candidate, next hygiene slice.
- N6: Some native-R reference numbers in tests lack committed regeneration scripts (point estimates have them via runs-in-r; some SE/CI pins do not) - standing convention debt.
- N7: Process incident, resolved: one fix-round commit accidentally swept your 15 untracked docs into history; caught at final review, history rewritten (they are untracked again, byte-identical), and commit-message hygiene re-verified across the slice. A pre-commit path-guard is the recommended permanent fix.

## Acceptance

`npm run build && npm run preview` - suggested tour: CB-SEM with a moderation edge on the ESG dataset (tests/e2e/fixtures/sem-moderation.csv), PLS-SEM with an interaction, one regression, one t-test; check the new Table 1/Table 5 shapes against the boards, the Statistical basis footers, the term-led explainers with your run's numbers, the baseline diffs. Then your push word (and deploy remains its own decision).
