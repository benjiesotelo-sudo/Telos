// LICENSES.txt body for the export bundle: credits every third-party work the exported
// scripts/figures/fonts depend on, with a licence name + canonical URL each. The R-package set
// mirrors engine.ts preload (the authoritative list) plus modelsummary, which the emitted
// R scripts use for the coef tables but is installed by the script itself (not preloaded).

// CRAN package page per name (canonical, stable).
const PKGS: [name: string, blurb: string][] = [
  ['modelsummary', 'regression/coef tables in the exported R scripts'],
  ['ggplot2', 'figures (boxplots, IRF, love plots, …)'],
  ['plm', 'panel models — fixed/random effects, Hausman'],
  ['sandwich', 'robust/clustered standard errors'],
  ['lmtest', 'coefficient tests, Granger causality'],
  ['ivreg', 'two-stage least squares (2SLS / instrumental variables)'],
  ['rdrobust', 'regression discontinuity'],
  ['MatchIt', 'propensity-score matching'],
  ['forecast', 'ARIMA/SARIMA auto-fitting and forecasting'],
  ['tseries', 'stationarity tests (ADF, KPSS)'],
  ['urca', 'unit-root and cointegration tests'],
  ['vars', 'vector autoregression, impulse-response'],
  ['emmeans', 'estimated marginal means / post-hoc contrasts'],
  ['car', 'companion regression diagnostics'],
  ['afex', 'factorial ANOVA'],
  ['rstatix', 'tidy statistical tests'],
  ['effectsize', 'standardized effect sizes'],
  ['parameters', 'standardized model parameters'],
  ['performance', 'model fit indices'],
  ['pROC', 'ROC / AUC'],
  ['nortest', 'normality tests'],
  ['psych', 'descriptive and psychometric statistics'],
  ['coin', 'permutation tests'],
  ['janitor', 'data cleaning / cross-tabulation'],
]

export function licensesText(): string {
  const lines: string[] = []
  lines.push('Telos — Third-Party Licences and Acknowledgements')
  lines.push('=================================================')
  lines.push('')
  lines.push('Telos bundles and/or generates code that relies on the open-source works below.')
  lines.push('Each is credited with its licence and a canonical URL. No warranty is made by Telos')
  lines.push('for these third-party works; refer to each project for its full licence text.')
  lines.push('')

  lines.push('R language and standard library')
  lines.push('  Licence: GNU GPL (versions 2 and 3)')
  lines.push('  https://www.r-project.org/Licenses/')
  lines.push('')
  lines.push('WebR (R compiled to WebAssembly — runs R in the browser)')
  lines.push('  Licence: GPL-3.0 (the WebR distribution; bundled R is GPL)')
  lines.push('  https://github.com/r-wasm/webr')
  lines.push('')

  lines.push('R packages (each on CRAN under its own open-source licence — see the package page)')
  for (const [name, blurb] of PKGS) {
    lines.push(`  ${name} — ${blurb}`)
    lines.push(`  https://CRAN.R-project.org/package=${name}`)
  }
  lines.push('')

  lines.push('Fonts (SIL Open Font License, Version 1.1 — http://scripts.sil.org/OFL)')
  lines.push('  Crimson Pro — Copyright 2018 The Crimson Pro Project Authors')
  lines.push('  https://github.com/Fonthausen/CrimsonPro')
  lines.push('  Atkinson Hyperlegible — Copyright 2020 Braille Institute of America, Inc.')
  lines.push('  https://www.brailleinstitute.org/freefont')
  lines.push('  (Full OFL text ships alongside each font in this distribution.)')
  lines.push('')

  return lines.join('\n')
}
