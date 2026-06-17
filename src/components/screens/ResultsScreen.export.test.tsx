import { describe, it, expect } from 'vitest'
import type { SessionState, TestSetup, TestRun } from '../../state/session'
import type { SimpleLinearResult } from '../../lib/stats/simpleLinearRegression'
import type { OneWayAnovaResult } from '../../lib/stats/oneWayAnova'
import { buildExportFiles } from './ResultsScreen'

// Pure file-map assembly (Task 10). Node env, no DOM: buildExportFiles covers the
// non-DOM artifacts (R/csv/tex/licenses/figure PNGs); table PNGs (captureNode) stay in
// the component. Fixtures mirror latex.test.ts so the builders produce real content.
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const slr: SimpleLinearResult = {
  outcome: 'score', predictor: 'hours',
  r2: 0.42, adjR2: 0.41, f: 71.2, df1: 1, df2: 98, p: 0.001, sigma: 1.2,
  rmse: 1.18, aic: 320.1, bic: 327.9, logLik: -157.0,
  terms: [
    { term: '(Intercept)', b: 0.5, se: 0.1, beta: null, t: 5.0, p: 0.001, ciLow: 0.3, ciHigh: 0.7 },
    { term: 'study_hours', b: 1.2, se: 0.2, beta: 0.45, t: 6.0, p: 0.001, ciLow: 0.8, ciHigh: 1.6 },
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

const setups: Record<string, TestSetup> = {
  'simple-linear-regression': { roles: { outcome: ['score'], predictor: ['hours'] }, options: {}, props: {}, blocked: null },
  'one-way-anova': { roles: { outcome: ['score'], factor: ['grp'] }, options: {}, props: {}, blocked: null },
}
const runs: Record<string, TestRun> = {
  'simple-linear-regression': { result: slr, stale: false },
  'one-way-anova': { result: anova, stale: false },
}

// minimal session: only the fields buildExportFiles + workingDataset read.
// missingPolicy 'leave' makes workingDataset a pass-through of raw, so columns are unused here.
const session = (): SessionState => ({
  selection: ['simple-linear-regression', 'one-way-anova'],
  setups, runs,
  raw: { columns: ['score', 'hours', 'grp'], rows: [{ score: 5, hours: 2, grp: 'A' }, { score: 7, hours: 4, grp: 'B' }] },
  columns: [],
  missingPolicy: 'leave',
} as unknown as SessionState)

describe('buildExportFiles (Task 10)', () => {
  it('assembles R + csv + tex + licenses + latex figure PNGs when r & latex are ticked', () => {
    const files = buildExportFiles(session(), { tables: false, figures: false, pdf: false, latex: true, r: true })
    const keys = Object.keys(files)
    expect(keys).toContain('analysis.R')
    expect(keys).toContain('cleaned.csv')
    expect(keys).toContain('report.tex')
    expect(keys).toContain('LICENSES.txt')
    expect(keys.some((k) => /^figures\/\d\d_[^/]+\/figure_.*\.png$/.test(k))).toBe(true)
    // latex figure paths must match emitLatex's \includegraphics references exactly
    expect(keys).toContain('figures/01_simple-linear-regression/figure_fit.png')
    expect(keys).toContain('figures/02_one-way-anova/figure_means-plot.png')
  })

  it('decodes the string artifacts back to the emitted content', () => {
    const files = buildExportFiles(session(), { tables: false, figures: false, pdf: false, latex: true, r: true })
    const dec = new TextDecoder()
    expect(dec.decode(files['report.tex'])).toContain('\\documentclass{article}')
    expect(dec.decode(files['cleaned.csv'])).toContain('score,hours,grp')
    expect(dec.decode(files['analysis.R'])).toContain('read.csv')
  })

  it('figures-only writes NN_id/figure_*.png and no string artifacts', () => {
    const files = buildExportFiles(session(), { tables: false, figures: true, pdf: false, latex: false, r: false })
    const keys = Object.keys(files)
    expect(keys).toContain('01_simple-linear-regression/figure_fit.png')
    expect(keys).toContain('02_one-way-anova/figure_means-plot.png')
    expect(keys).not.toContain('analysis.R')
    expect(keys).not.toContain('report.tex')
    expect(keys).not.toContain('LICENSES.txt')
  })

  it('skips stale runs', () => {
    const s = session()
    s.runs['one-way-anova'] = { result: anova, stale: true }
    const files = buildExportFiles(s, { tables: false, figures: true, pdf: false, latex: false, r: false })
    const keys = Object.keys(files)
    expect(keys).toContain('01_simple-linear-regression/figure_fit.png')
    expect(keys.some((k) => k.startsWith('02_'))).toBe(false)
  })

  it('LICENSES.txt is added for r-only too', () => {
    const files = buildExportFiles(session(), { tables: false, figures: false, pdf: false, latex: false, r: true })
    expect(Object.keys(files)).toContain('LICENSES.txt')
  })

  // Gap case (BLOCKER regression): when a non-fresh test precedes a fresh one in the selection, the
  // report.tex \includegraphics NN must equal the figure-PNG key NN (the FULL-selection index), so the
  // figures resolve. Here A (simple-linear-regression) has NO run; B (one-way-anova) is fresh → B is 02.
  it('report.tex figure NN matches the figure PNG NN when an earlier selected test is not fresh', () => {
    const s = session()
    // Self-contained runs (the shared fixture is mutated by sibling tests): A has NO run, B is fresh.
    s.runs = { 'one-way-anova': { result: anova, stale: false } }
    delete (s.runs as Record<string, TestRun>)['simple-linear-regression'] // A: no run → not fresh, no \section
    const files = buildExportFiles(s, { tables: false, figures: true, pdf: false, latex: true, r: false })
    const dec = new TextDecoder()
    const tex = dec.decode(files['report.tex'])
    // B keeps its full-selection index (02), NOT 01 (which it would get if numbered within `fresh`).
    expect(tex).toContain('\\includegraphics{figures/02_one-way-anova/figure_means-plot.png}')
    expect(tex).not.toContain('\\includegraphics{figures/01_one-way-anova/figure_means-plot.png}')
    // ...and that exact path is the figure PNG key buildExportFiles writes.
    expect(Object.keys(files)).toContain('figures/02_one-way-anova/figure_means-plot.png')
    // A produced no run, so no \section / no figure for it.
    expect(tex).not.toContain('\\section{Simple linear regression}')
    expect(Object.keys(files).some((k) => k.includes('simple-linear-regression'))).toBe(false)
  })
})
