// CITATIONS.txt body for the export bundle: a tiered reference kit (direction B), four sections —
//   1. Cite this app (src/lib/export/citeApp.ts)
//   2. Your reference list — the selected tests' whyThisTest + statisticalBasis refs, DEDUPED across
//      tests and alphabetized by leading-author surname; a ref shared by 2+ tests gets one
//      "[used by: ...]" annotation line instead of repeating.
//   3. Methods paragraph — one sentence per selected test. Uses the LIVE apaTemplate-filled sentence
//      (CardContent.apa, threaded in from buildExportFiles via `apaById`) when the test has actually
//      been run; otherwise falls back to the registry's whyThisTest prose (no fabricated numbers).
//      Chose this hybrid over a numbers-free paragraph for every test because the live values ARE
//      reachable at export time (buildExportFiles already builds CardContent per fresh test for its
//      figures) — threading them here is a small wiring change, not the re-architecture the brief
//      flagged as out of scope.
//   4. Appendix: R package citations — the original (pre-kit) package-references section, content
//      unchanged, just relabeled and moved to the end. The R version plus a citation()-style
//      reference for every R package the emitted script actually uses; the package set is the UNION
//      of every emitter's `*Packages` record (rScript/emitters PACKAGES), so it stays reconciled
//      automatically.
import { PACKAGES } from './rScript/emitters'
import { CITATIONS, effectiveStatisticalBasis, type Ref } from '../registry/citations'
import { CATALOG } from '../registry/catalog'
import { CITE_APP_TEXT } from './citeApp'
import type { TestSetup } from '../../state/session'

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
  lavaan:
    'Rosseel Y (2012). "lavaan: An R Package for Structural Equation Modeling." Journal of Statistical Software, 48(2), 1-36. https://CRAN.R-project.org/package=lavaan',
  semTools:
    'Jorgensen TD, Pornprasertmanit S, Schoemann AM, Rosseel Y (2022). semTools: Useful tools for structural equation modeling. R package. https://CRAN.R-project.org/package=semTools',
  seminr:
    'Ray S, Danks N, Calero Valdéz A (2021). seminr: Domain-Specific Language for Building PLS Structural Equation Models. R package. https://CRAN.R-project.org/package=seminr',
  semPlot:
    'Epskamp S (2019). semPlot: Path Diagrams and Visual Analysis of Various SEM Packages’ Output. R package. https://CRAN.R-project.org/package=semPlot',
}

// The reconciled union of every package the emitters install/use, sorted for stable output.
function emittedPackages(): string[] {
  const set = new Set<string>()
  for (const pkgs of Object.values(PACKAGES)) for (const p of pkgs) set.add(p)
  return [...set].sort((a, b) => a.localeCompare(b))
}

const testName = (id: string): string => CATALOG.find((c) => c.id === id)?.name ?? id

// Every whyThisTest + statisticalBasis ref cited by a test, de-duplicated once per test (so a ref
// used twice WITHIN one test's own entry doesn't make that test appear twice in its "[used by:]").
// `setup` (Task 8) threads the run's own options through effectiveStatisticalBasis so a
// conditionally-earned ref (e.g. Yuan-Bentler under MLR) appears in the reference list too - omitted,
// this resolves to the always-on statisticalBasis, matching pre-Task-8 output exactly.
const refsOf = (id: string, setup?: TestSetup): Ref[] => {
  const c = CITATIONS[id]
  if (!c) return []
  const seen = new Set<string>()
  const out: Ref[] = []
  for (const ref of [...c.whyThisTest.refs, ...effectiveStatisticalBasis(id, setup).map((b) => b.ref)]) {
    if (seen.has(ref.text)) continue
    seen.add(ref.text)
    out.push(ref)
  }
  return out
}

// Leading-author surname, parsed from the ref's own structured `authors` field (itself a mechanical
// transcription of `text`'s start) — the sort key for section 2's alphabetical order.
const surnameOf = (ref: Ref): string => ref.authors.split(',')[0].trim().split(/\s+/)[0]?.toLowerCase() ?? ''

// Section 2: dedup a selection's refs by exact text (the same Ref constant, wherever reused, is the
// same reference), collecting which test(s) cite it, then sort alphabetically. Array#sort is stable
// in every engine Telos targets, so equal surnames keep their first-encountered relative order.
function referenceListLines(selection: string[], setups: Record<string, TestSetup>): string[] {
  const byText = new Map<string, { ref: Ref; tests: string[] }>()
  for (const id of selection) {
    const name = testName(id)
    for (const ref of refsOf(id, setups[id])) {
      const entry = byText.get(ref.text)
      if (entry) entry.tests.push(name)
      else byText.set(ref.text, { ref, tests: [name] })
    }
  }
  const entries = [...byText.values()].sort((a, b) => surnameOf(a.ref).localeCompare(surnameOf(b.ref)))
  const lines: string[] = []
  for (const { ref, tests } of entries) {
    lines.push(`  ${ref.text}${ref.url ? ' ' + ref.url : ''}`)
    if (tests.length > 1) lines.push(`    [used by: ${tests.join(', ')}]`)
  }
  return lines.length ? lines : ['  (no tests selected)']
}

// Section 3: one sentence per selected test. Prefers the live apaTemplate-filled sentence
// (CardContent.apa) when the test has actually been run this session (`apaById`); otherwise falls
// back to the registry's own "why this test" prose — never fabricates numbers for an unrun test.
function methodsParagraphLines(selection: string[], apaById: Record<string, string>): string[] {
  const lines: string[] = []
  for (const id of selection) {
    const c = CITATIONS[id]
    if (!c) continue
    const cite = c.whyThisTest.refs.map((r) => `${r.authors.split(',')[0].trim()}, ${r.year}`).join('; ')
    const sentence = apaById[id] ?? c.whyThisTest.text
    lines.push(`  ${testName(id)}: ${sentence}${cite ? ` (${cite})` : ''}`)
  }
  return lines.length ? lines : ['  (no tests selected)']
}

// apaById: CardContent.apa per already-run test this export session (buildExportFiles threads this
// through from the same loop that already builds each fresh test's content for its figures — see
// that file's comment for why this doesn't need a deeper re-architecture).
export function citationsText(
  selection: string[] = [],
  apaById: Record<string, string> = {},
  // Task 8: the run's own setups, so a conditionally-earned ref (estimator/missing-method) appears
  // in section 2 - omitted, this resolves identically to pre-Task-8 output (the byte-pin).
  setups: Record<string, TestSetup> = {},
): string {
  const lines: string[] = []
  lines.push('Telos — Citations for the Exported Analysis')
  lines.push('===========================================')
  lines.push('')
  lines.push('A tiered reference kit: cite the app, cite your selected tests’ references, drop in a')
  lines.push('methods-paragraph summary, and credit the R packages your analysis.R depends on.')
  lines.push('')

  lines.push('1. CITE THIS APP')
  lines.push('================')
  lines.push(CITE_APP_TEXT)
  lines.push('')

  lines.push('2. YOUR REFERENCE LIST')
  lines.push('=======================')
  lines.push(...referenceListLines(selection, setups))
  lines.push('')

  lines.push('3. METHODS PARAGRAPH')
  lines.push('=====================')
  lines.push(...methodsParagraphLines(selection, apaById))
  lines.push('')

  lines.push('4. APPENDIX: R PACKAGE CITATIONS')
  lines.push('=================================')
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

  return lines.join('\n') + '\n'
}
