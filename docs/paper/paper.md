---
title: 'Telos: a browser-based, privacy-preserving statistics platform for thesis students, running real R via WebAssembly'
tags:
  - R
  - WebAssembly
  - statistics
  - structural equation modeling
  - reproducibility
  - education
  - open science
authors:
  - name: Benjamin Sotelo
    orcid: 0009-0005-8027-6166
    affiliation: 1
affiliations:
  - name: "Far Eastern University"
    index: 1
date: 08 July 2026
bibliography: paper.bib
---

# Summary

Telos is a browser-based statistical analysis application built for thesis students.
It runs a real R interpreter client-side using webR, an R-to-WebAssembly build [@stagg2023webr], so every analysis executes inside the user's browser tab.
No statistics server is involved, no software install is required, and no account is needed.
Telos's own welcome screen states the privacy property plainly: "Your data never leaves your browser."
A student uploads a CSV or Excel file, is guided through labeling each column's measurement level, picks from a catalog of 48 statistical tests spanning descriptive statistics, parametric and nonparametric group comparisons, association and categorical tests, regression, econometrics, and latent-variable/structural equation models (SEM), and receives an APA-7-styled results screen with plain-language explainers.
Every result can be exported as image tables and figures, a reproducible R script with cleaned data, a native LaTeX report, or a print-ready PDF.

# Statement of need

Thesis students doing quantitative work face a specific combination of constraints that existing tools do not jointly solve.
They need software that costs nothing and requires no license, since most are not affiliated with a paid SPSS or Stata seat.
They need to keep participant data off third-party servers, since much thesis data involves human subjects and comes with ethics-board handling requirements.
They need results they can cite correctly, since misapplied or mis-cited statistical conventions are a well-documented problem in student and even published work.
And they need to be able to prove, to a supervisor or an examiner, that the numbers in their report are the numbers their software actually computed.

Free, general-purpose alternatives exist.
JASP [@love2019jasp] and jamovi [@jamovi] are open-source, GUI-driven statistics packages built on R, and G*Power [@faul2007gpower] is a widely used, free power-analysis tool.
All three are native desktop applications that must be downloaded and installed, and jamovi's advanced modules can require a local R toolchain.
None of them, to our knowledge, combine a zero-install, in-browser workflow with an inline, point-of-use citation registry and a verification pipeline that checks the software's own output against a native statistical engine on every release.
Telos addresses this gap: it runs entirely client-side via WebAssembly, so there is no server that ever receives a student's data file, and every one of its 48 tests is checked against native R and shipped with the citations a student needs to write a methods section correctly.

# Functionality

Telos guides a student through seven steps: Welcome, Upload (CSV or Excel), a Terms guide (measurement levels, missingness, assumptions), Configure data (column types and levels, missing-data policy), Pick a test, Configure test (assigning columns to the test's roles), and Results/export.
The 48-test catalog is organized into seven families:

- **Descriptive statistics** - summary statistics, frequencies and cross-tabs, distribution and normality checks.
- **Group comparisons** - the parametric family (one-sample, independent, and paired t-tests; one-way, factorial, repeated-measures, mixed, nested, and Welch's ANOVA; ANCOVA, MANOVA, MANCOVA) and the nonparametric family (Mann-Whitney U, Wilcoxon signed-rank, Kruskal-Wallis, Friedman).
- **Association** - correlation (Pearson, Spearman, Kendall's tau) and categorical association (chi-square independence and goodness-of-fit, Fisher's exact).
- **Regression and prediction** - simple and multiple linear regression, logistic regression, Poisson/negative binomial regression.
- **Econometrics** - time series (ARIMA/SARIMA, stationarity tests, Granger causality, VAR), panel data (fixed effects, random effects, Hausman test), and causal inference (difference-in-differences, regression discontinuity, instrumental variables/2SLS, propensity score matching).
- **Latent variable models** - reliability (Cronbach's alpha, average variance extracted, composite reliability), exploratory factor analysis, and structural equation modeling: confirmatory (CB-SEM) via lavaan [@rosseel2012lavaan] and variance-based (PLS-SEM) via seminr [@ray2021seminr], both including path analysis/mediation with bootstrapped indirect-effect confidence intervals, and latent moderation with simple-slopes analysis.
- **Data reduction** - principal component analysis.

For SEM, the student draws the measurement model in a form and the structural paths on an interactive path-diagram canvas; the same canvas renders the fitted path estimates once the model runs.
Every results screen states which test was recommended and why, cites the statistical basis for every reported statistic, and flags assumption checks with an explicit pass/fail verdict rather than leaving the reader to interpret a p-value alone.
The export panel bundles table and figure images, a reproducible `analysis.R` script (built to mirror the app's own model calls and verified to run under native R), a native-booktabs LaTeX report, and a print-to-PDF report, all styled to APA 7th-edition conventions [@appelbaum2018jars].

# Verification

Telos's central credibility claim is that its browser-computed statistics match native R exactly, and that this is checked automatically rather than asserted.
Every statistical routine is validated against native R 4.6.0 as part of the test suite.
For every export, the emitted `analysis.R` script is executed under a native R installation and its output is compared against the app's own on-screen results; this "runs-in-r" gate currently passes 31 native R executions covering the exported scripts across the test catalog, so a student's downloaded script is guaranteed to reproduce the app's numbers rather than merely resembling them.
Per-test documentation exists for each of the 48 tests, pairing the app's rendered output with the corresponding native-R console output for direct comparison.
Statistical claims made anywhere in the interface (a results card footer, an exported LaTeX report, a downloaded `CITATIONS.txt`) are drawn from a single citation registry of 87 references, applied at the point each claim is made rather than as a generic reading list; a provenance audit of this registry caught and corrected several real citation errors before release, including a composite-reliability cutoff commonly mis-attributed to @fornell1981evaluating that is properly attributed to @nunnally1978psychometric.
Where a test's assumptions are not met, or an estimator is not what the student might expect, the interface says so explicitly (for example, disclosing when a default estimator or missing-data method was used) rather than presenting a single unqualified number.

# Acknowledgements

The author thanks the developers of R [@rcoreteam2026], webR [@stagg2023webr], lavaan [@rosseel2012lavaan], and seminr [@ray2021seminr], on which Telos depends entirely for its statistical computation.

**AI usage disclosure.** Telos was developed with the assistance of AI coding tools.
All statistical design decisions, acceptance criteria, and the verification strategy described above were specified and reviewed by the author, who validated every statistical implementation against native R before release.
The author takes full responsibility for the correctness, licensing, and originality of the released software.

# References
