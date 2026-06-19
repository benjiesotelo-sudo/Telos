import { describe, it, expect } from 'vitest'
import { SPECS } from '../registry/catalog'
import type { TestSetup, TestRun } from '../../state/session'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'
import type { OneWayAnovaResult } from '../stats/oneWayAnova'
import type { AveResult } from '../stats/runAve'
import { emitLatex } from './latex'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const slr: SimpleLinearResult = {
  outcome: 'score', predictor: 'hours',
  r2: 0.42, adjR2: 0.41, f: 71.2, df1: 1, df2: 98, p: 0.001, sigma: 1.2,
  rmse: 1.18, aic: 320.1, bic: 327.9, logLik: -157.0,
  terms: [
    { term: '(Intercept)', b: 0.5, se: 0.1, beta: null, t: 5.0, p: 0.001, ciLow: 0.3, ciHigh: 0.7 },
    { term: 'study_hours', b: 1.2, se: 0.2, beta: 0.45, t: 6.0, p: 0.001, ciLow: 0.8, ciHigh: 1.6 }, // underscore exercises cell escaping
  ],
  ciLevel: 0.95, alpha: 0.05, n: 100, nExcluded: 0,
  figFitPng: png, figResidualsPng: png,
}

const anova: OneWayAnovaResult = {
  desc: [{ group: 'A', n: 10, m: 5, sd: 1 }, { group: 'B', n: 10, m: 7, sd: 1.2 }],
  ssB: 20, dfB: 1, msB: 20, f: 14.3, p: 0.002, eta2: 0.43, eta2Low: 0.1, eta2High: 1,
  ssW: 25, dfW: 18, msW: 1.4,
  levene: { F: 0.4, p: 0.6 }, shapiro: { W: 0.97, p: 0.5 },
  posthoc: [{ pair: 'A-B', diff: -2, se: 0.5, pAdj: 0.002, ciLo: -3, ciHi: -1 }],
  posthocMethod: 'Tukey HSD',
  ciLevel: 0.95, alpha: 0.05, nExcluded: 0, figurePng: png,
}

const selection = ['simple-linear-regression', 'one-way-anova']
const setups: Record<string, TestSetup> = {
  'simple-linear-regression': { roles: {}, options: {}, props: {}, blocked: null },
  'one-way-anova': { roles: {}, options: {}, props: {}, blocked: null },
}
const runs: Record<string, TestRun> = {
  'simple-linear-regression': { result: slr, stale: false },
  'one-way-anova': { result: anova, stale: false },
}

const tex = () => emitLatex(selection, setups, SPECS, runs)

describe('emitLatex', () => {
  it('opens with the documentclass + booktabs/graphicx/siunitx preamble', () => {
    const out = tex()
    expect(out).toContain('\\documentclass{article}')
    expect(out).toContain('\\usepackage{booktabs,graphicx,siunitx}')
    expect(out).toContain('\\begin{document}')
    expect(out).toContain('\\end{document}')
  })
  it('writes one \\section per selected test, in selection order', () => {
    const out = tex()
    expect(out).toContain('\\section{Simple linear regression}')
    expect(out).toContain('\\section{One-way ANOVA + post-hoc}')
    expect(out.indexOf('\\section{Simple linear regression}')).toBeLessThan(out.indexOf('\\section{One-way ANOVA + post-hoc}'))
  })
  it('renders each test\'s table(s) as booktabs tabular', () => {
    const out = tex()
    expect(out).toContain('\\begin{tabular}')
    expect(out).toContain('\\toprule')
    expect(out).toContain('\\bottomrule')
  })
  it('includes each figure at figures/NN_id/figure_*.png (1-based, padded)', () => {
    const out = tex()
    expect(out).toContain('\\includegraphics{figures/01_simple-linear-regression/figure_fit.png}')
    expect(out).toContain('\\includegraphics{figures/01_simple-linear-regression/figure_residuals.png}')
    expect(out).toContain('\\includegraphics{figures/02_one-way-anova/figure_means-plot.png}')
  })
  it('emits the how-to-read text and the APA paragraph', () => {
    const out = tex()
    expect(out).toContain('share of outcome variance explained') // SLR how-to-read fragment
    expect(out).toContain('A simple linear regression gave') // SLR APA fragment
  })
  it('escapes special characters in emitted table cell text', () => {
    const out = tex()
    expect(out).toContain('study\\_hours') // the term name's underscore is escaped in the coef table
    expect(out).not.toContain('study_hours &') // ...and the raw form does not survive
  })
})

// AVE (and EFA) carry kind:'matrix' tables (Fornell-Larcker, HTMT, interfactor-Φ) whose data lives in
// BuiltTable.matrix with empty spec.columns — they must route to matrixToLatex, NOT classicToLatex
// (which would emit \begin{tabular}{} → "Empty preamble" → the whole report.tex fails to compile).
const ave: AveResult = {
  figValidityPng: png,
  cfa: {
    labels: ['visual', 'memory'],
    perConstruct: [
      { name: 'visual', ave: 0.55, cr: 0.78, omega: 0.78, alpha: 0.75 },
      { name: 'memory', ave: 0.60, cr: 0.81, omega: 0.81, alpha: 0.79 },
    ],
    fornellLarcker: [[0.74, 0], [0.45, 0.77]],
    htmt: [[0, 0], [0.30, 0]],
  },
}

describe('emitLatex — matrix tables (AVE Fornell-Larcker + HTMT)', () => {
  const out = emitLatex(['ave'], { ave: { roles: {}, options: {}, props: {}, blocked: null } }, SPECS, { ave: { result: ave, stale: false } })
  it('routes matrix tables to a non-empty booktabs tabular (1 label + N construct columns)', () => {
    expect(out).not.toContain('\\begin{tabular}{}') // the empty-preamble bug must be gone
    expect(out).toContain('\\begin{tabular}{lcc}') // 2 constructs → l + c + c
  })
  it('includes the construct labels in the matrix', () => {
    expect(out).toContain('visual')
    expect(out).toContain('memory')
  })
})
