// CITATIONS.txt body for the export bundle: the citeable references behind the exported analysis.R —
// the R version plus a citation()-style reference for every R package the emitted script actually
// uses. The package set is the UNION of every emitter's `*Packages` record (rScript/emitters PACKAGES),
// so it stays reconciled automatically: an emitter that starts using a package gets it cited here,
// and a package no emitter references is silently absent. Each line mirrors what R's own
// citation("<pkg>") would surface (authors, year, title, CRAN URL).

import { PACKAGES } from './rScript/emitters'

const R_VERSION = 'R 4.6.0'

// citation()-style reference per package (author(s), year, title, CRAN page). Keep keyed by the
// exact package name emitters reference so the union below resolves a reference for each.
const REFS: Record<string, string> = {
  modelsummary:
    'Arel-Bundock V (2022). "modelsummary: Data and Model Summaries in R." Journal of Statistical Software, 103(1), 1-23. https://CRAN.R-project.org/package=modelsummary',
  ggplot2:
    'Wickham H (2016). ggplot2: Elegant Graphics for Data Analysis. Springer-Verlag New York. https://CRAN.R-project.org/package=ggplot2',
  parameters:
    'Lüdecke D, Ben-Shachar MS, Patil I, Makowski D (2020). "Extracting, Computing and Exploring the Parameters of Statistical Models using R." Journal of Open Source Software, 5(53), 2445. https://CRAN.R-project.org/package=parameters',
  performance:
    'Lüdecke D, Ben-Shachar MS, Patil I, Waggoner P, Makowski D (2021). "performance: An R Package for Assessment, Comparison and Testing of Statistical Models." Journal of Open Source Software, 6(60), 3139. https://CRAN.R-project.org/package=performance',
  effectsize:
    'Ben-Shachar MS, Lüdecke D, Makowski D (2020). "effectsize: Estimation of Effect Size Indices and Standardized Parameters." Journal of Open Source Software, 5(56), 2815. https://CRAN.R-project.org/package=effectsize',
  car: 'Fox J, Weisberg S (2019). An R Companion to Applied Regression, Third edition. Sage, Thousand Oaks CA. https://CRAN.R-project.org/package=car',
  pROC: 'Robin X, Turck N, Hainard A, et al. (2011). "pROC: an open-source package for R and S+ to analyze and compare ROC curves." BMC Bioinformatics, 12, 77. https://CRAN.R-project.org/package=pROC',
  MASS: 'Venables WN, Ripley BD (2002). Modern Applied Statistics with S, Fourth edition. Springer, New York. https://CRAN.R-project.org/package=MASS',
  forecast:
    'Hyndman R, Athanasopoulos G, Bergmeir C, et al. (2024). forecast: Forecasting functions for time series and linear models. R package. https://CRAN.R-project.org/package=forecast',
  tseries:
    'Trapletti A, Hornik K (2024). tseries: Time Series Analysis and Computational Finance. R package. https://CRAN.R-project.org/package=tseries',
  lmtest:
    'Zeileis A, Hothorn T (2002). "Diagnostic Checking in Regression Relationships." R News, 2(3), 7-10. https://CRAN.R-project.org/package=lmtest',
  vars: 'Pfaff B (2008). "VAR, SVAR and SVEC Models: Implementation Within R Package vars." Journal of Statistical Software, 27(4). https://CRAN.R-project.org/package=vars',
  plm: 'Croissant Y, Millo G (2008). "Panel Data Econometrics in R: The plm Package." Journal of Statistical Software, 27(2), 1-43. https://CRAN.R-project.org/package=plm',
  rdrobust:
    'Calonico S, Cattaneo MD, Farrell MH, Titiunik R (2017). "rdrobust: Software for Regression-Discontinuity Designs." The Stata Journal, 17(2), 372-404. https://CRAN.R-project.org/package=rdrobust',
  ivreg:
    'Fox J, Kleiber C, Zeileis A (2024). ivreg: Instrumental-Variables Regression by 2SLS, 2SM, or 2SMM, with Diagnostics. R package. https://CRAN.R-project.org/package=ivreg',
  sandwich:
    'Zeileis A, Köll S, Graham N (2020). "Various Versatile Variances: An Object-Oriented Implementation of Clustered Covariances in R." Journal of Statistical Software, 95(1), 1-36. https://CRAN.R-project.org/package=sandwich',
  MatchIt:
    'Ho DE, Imai K, King G, Stuart EA (2011). "MatchIt: Nonparametric Preprocessing for Parametric Causal Inference." Journal of Statistical Software, 42(8), 1-28. https://CRAN.R-project.org/package=MatchIt',
  psych:
    'Revelle W (2024). psych: Procedures for Psychological, Psychometric, and Personality Research. Northwestern University, Evanston. https://CRAN.R-project.org/package=psych',
  emmeans:
    'Lenth RV (2024). emmeans: Estimated Marginal Means, aka Least-Squares Means. R package. https://CRAN.R-project.org/package=emmeans',
  afex: 'Singmann H, Bolker B, Westfall J, Aust F, Ben-Shachar MS (2024). afex: Analysis of Factorial Experiments. R package. https://CRAN.R-project.org/package=afex',
  rstatix:
    'Kassambara A (2023). rstatix: Pipe-Friendly Framework for Basic Statistical Tests. R package. https://CRAN.R-project.org/package=rstatix',
  coin: 'Hothorn T, Hornik K, van de Wiel MA, Zeileis A (2008). "Implementing a Class of Permutation Tests: The coin Package." Journal of Statistical Software, 28(8), 1-23. https://CRAN.R-project.org/package=coin',
  nortest:
    'Gross J, Ligges U (2015). nortest: Tests for Normality. R package. https://CRAN.R-project.org/package=nortest',
}

// The reconciled union of every package the emitters install/use, sorted for stable output.
function emittedPackages(): string[] {
  const set = new Set<string>()
  for (const pkgs of Object.values(PACKAGES)) for (const p of pkgs) set.add(p)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function citationsText(): string {
  const lines: string[] = []
  lines.push('Telos — Citations for the Exported Analysis')
  lines.push('===========================================')
  lines.push('')
  lines.push('The exported analysis.R was generated for R and relies on the packages cited below.')
  lines.push('Please cite the R version and each package you use in any resulting work.')
  lines.push('')

  lines.push('R language and environment')
  lines.push(
    `  R Core Team (2026). ${R_VERSION}: A Language and Environment for Statistical Computing.`,
  )
  lines.push('  R Foundation for Statistical Computing, Vienna, Austria. https://www.R-project.org/')
  lines.push('')

  lines.push('R packages (citation()-style references — run citation("<pkg>") in R for the canonical entry)')
  for (const name of emittedPackages()) {
    const ref = REFS[name] ?? `${name}. https://CRAN.R-project.org/package=${name}`
    lines.push(`  ${name}`)
    lines.push(`    ${ref}`)
  }
  lines.push('')

  lines.push(
    'Tables are formatted per APA-7 (7th ed.); econometric methods follow each package cited reference.',
  )
  lines.push('')

  return lines.join('\n')
}
