import { describe, it, expect } from 'vitest'
import { buildVar } from './buildVar'
import { VAR } from '../registry/var'
import type { VarResult } from '../stats/var'

// Mock = native-R 4.6.0 ground truth for VAR(Canada[,1:2], p=1) — the existing stats-test fixture.
// (Rscript on vars::Canada[,1:2], p=1, type='const': per-eq GOF, per-coef 95% CI via confint().)
//   eq 'e':    R²=0.996941 adjR²=0.996865 RMSE=0.498534 logLik=−59.997016 N=83
//   eq 'prod': R²=0.971158 adjR²=0.970437 RMSE=0.714595 logLik=−89.880666 N=83
//   e.l1   (eq e):    est=0.947896 se=0.012454 CI[0.923112, 0.972681]
//   prod.l1(eq prod): est=0.989163 se=0.039113 CI[0.911325, 1.067001]
//   max root modulus = 1.0173108 → NOT stable (p=1 Canada VAR is on the boundary)
const mock = (over: Partial<VarResult> = {}): VarResult => ({
  seriesNames: ['e', 'prod'],
  selectedLag: 1,
  lagRows: [{ lag: 1, aic: -1.97397, bic: -1.799114, hq: -1.9037227 }],
  coefRows: [
    { term: 'e.l1', equation: 'e', estimate: 0.947896, se: 0.012454, t: 76.111218, p: 2.09598e-76, ciLow: 0.923112, ciHigh: 0.972681 },
    { term: 'prod.l1', equation: 'e', estimate: 0.144209, se: 0.027287, t: 5.284853, p: 1.06288e-6, ciLow: 0.089906, ciHigh: 0.198513 },
    { term: 'const', equation: 'e', estimate: -9.219478, se: 5.953787, t: -1.548506, p: 0.125448, ciLow: -21.067891, ciHigh: 2.628936 },
    { term: 'e.l1', equation: 'prod', estimate: 0.013549, se: 0.017852, t: 0.75897, p: 0.450101, ciLow: -0.021977, ciHigh: 0.049075 },
    { term: 'prod.l1', equation: 'prod', estimate: 0.989163, se: 0.039113, t: 25.28961, p: 6.52806e-40, ciLow: 0.911325, ciHigh: 1.067001 },
    { term: 'const', equation: 'prod', estimate: -8.228987, se: 8.534113, t: -0.964246, p: 0.337828, ciLow: -25.212413, ciHigh: 8.75444 },
  ],
  eqGof: [
    { equation: 'e', r2: 0.996941, adjR2: 0.996865, rmse: 0.498534, logLik: -59.997016, nobs: 83 },
    { equation: 'prod', r2: 0.971158, adjR2: 0.970437, rmse: 0.714595, logLik: -89.880666, nobs: 83 },
  ],
  fevdRows: [
    { variable: 'e', impulse: 'e', share: 0.5518642 },
    { variable: 'e', impulse: 'prod', share: 0.4481358 },
    { variable: 'prod', impulse: 'e', share: 0.07046635 },
    { variable: 'prod', impulse: 'prod', share: 0.9295336 },
  ],
  maxRootModulus: 1.0173108,
  stable: false,
  ciLevel: 0.95,
  irfHorizon: 10,
  n: 84,
  nExcluded: 0,
  figIrfPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildVar — modelsummary side-by-side per-equation coef table', () => {
  it('overrides the placeholder columns/models with one column per response series', () => {
    const t2 = buildVar(VAR, mock()).tables[1]
    expect(t2.spec.columns.map((c) => c.key)).toEqual(['term', 'eq1', 'eq2'])
    expect(t2.spec.columns.map((c) => c.label)).toEqual(['', 'e', 'prod'])
    expect(t2.spec.models!.map((m) => ({ key: m.key, label: m.label }))).toEqual([
      { key: 'eq1', label: 'e' }, { key: 'eq2', label: 'prod' },
    ])
  })

  it('emits coef → (SE) → [CI] rows per term, est filled per equation column (t/p drop)', () => {
    const rows = buildVar(VAR, mock()).tables[1].rows
    // Union of terms ordered by first appearance: e.l1, prod.l1, const
    const coefRows = rows.filter((r) => r['_kind'] === 'coef')
    expect(coefRows.map((r) => r.term)).toEqual(['e.l1', 'prod.l1', 'const'])

    // e.l1 row: estimate per column; then muted (SE); then muted [CI]
    const i = rows.findIndex((r) => r['_kind'] === 'coef' && r.term === 'e.l1')
    expect(rows[i]).toMatchObject({ _kind: 'coef', term: 'e.l1', eq1: '0.95', eq2: '0.01' })
    expect(rows[i + 1]).toMatchObject({ _kind: 'se', term: '', eq1: '(0.01)', eq2: '(0.02)' })
    expect(rows[i + 2]).toMatchObject({ _kind: 'ci', term: '', eq1: '[0.92, 0.97]', eq2: '[−0.02, 0.05]' })

    // prod.l1 estimate in the 'prod' column = 0.99, CI [0.91, 1.07]
    const j = rows.findIndex((r) => r['_kind'] === 'coef' && r.term === 'prod.l1')
    expect(rows[j].eq2).toBe('0.99')
    expect(rows[j + 2].eq2).toBe('[0.91, 1.07]')

    // No t/p ever appear in the visible cells
    for (const r of rows) for (const v of Object.values(r)) {
      expect(String(v)).not.toContain('76.11') // t for e.l1
    }
  })

  it('GOF footer: one value per equation column (Num.Obs./R²/R² Adj./RMSE/Log.Lik.)', () => {
    const rows = buildVar(VAR, mock()).tables[1].rows
    const gof = rows.filter((r) => r['_kind'] === 'gof')
    expect(gof.map((r) => r.term)).toEqual(['Num.Obs.', 'R²', 'R² Adj.', 'RMSE', 'Log.Lik.'])
    const byLabel = (label: string) => gof.find((r) => r.term === label)!
    expect(byLabel('Num.Obs.')).toMatchObject({ eq1: '83', eq2: '83' })
    expect(byLabel('R²')).toMatchObject({ eq1: '1.00', eq2: '.97' }) // 0.996941→1.00 (bounded f01)
    expect(byLabel('R² Adj.')).toMatchObject({ eq1: '1.00', eq2: '.97' })
    expect(byLabel('RMSE')).toMatchObject({ eq1: '0.50', eq2: '0.71' })
    expect(byLabel('Log.Lik.')).toMatchObject({ eq1: '−60.00', eq2: '−89.88' })
  })

  it('a rule precedes the GOF footer; SYSTEM span rows follow with lag p + stability', () => {
    const rows = buildVar(VAR, mock()).tables[1].rows
    const ruleIdx = rows.findIndex((r) => r['_kind'] === 'rule')
    const firstGof = rows.findIndex((r) => r['_kind'] === 'gof')
    const firstSpan = rows.findIndex((r) => r['_kind'] === 'span')
    expect(ruleIdx).toBeGreaterThanOrEqual(0)
    expect(ruleIdx).toBeLessThan(firstGof)   // rule before gof
    expect(firstGof).toBeLessThan(firstSpan) // gof before span
    const spans = rows.filter((r) => r['_kind'] === 'span')
    expect(spans[0].term).toBe('Selected lag (p) = 1')
    expect(spans[1].term).toBe('Max root modulus = 1.02 (unstable)')
  })

  it('marks the VAR stable when max root modulus < 1', () => {
    const rows = buildVar(VAR, mock({ maxRootModulus: 0.9961645, stable: true })).tables[1].rows
    const spans = rows.filter((r) => r['_kind'] === 'span')
    expect(spans[1].term).toBe('Max root modulus = 1.00 (stable)')
  })

  it('keeps Table 1 (lag selection) + Table 3 (FEVD) as classic tables and APA reports the selected lag', () => {
    const c = buildVar(VAR, mock())
    expect(c.tables[0].spec.id).toBe('lag-selection')
    expect(c.tables[0].rows[0]).toMatchObject({ lag: 1, aic: '−1.97' })
    expect(c.tables[2].spec.id).toBe('fevd')
    expect(c.tables[2].rows[0]).toMatchObject({ variable: 'e', impulse: 'e', share: '.55' })
    expect(c.apa).toBe('A VAR(1) model was selected by AIC; impulse-response functions are shown (Figure).')
    expect(c.tables).toHaveLength(3)
  })

  it('handles a 3-series VAR (column count is data-dependent)', () => {
    const t2 = buildVar(VAR, mock({
      seriesNames: ['a', 'b', 'c'],
      coefRows: [
        { term: 'a.l1', equation: 'a', estimate: 0.5, se: 0.1, t: 5, p: 0.01, ciLow: 0.3, ciHigh: 0.7 },
        { term: 'a.l1', equation: 'b', estimate: 0.2, se: 0.1, t: 2, p: 0.04, ciLow: 0.0, ciHigh: 0.4 },
        { term: 'a.l1', equation: 'c', estimate: 0.1, se: 0.1, t: 1, p: 0.3, ciLow: -0.1, ciHigh: 0.3 },
      ],
      eqGof: [
        { equation: 'a', r2: 0.8, adjR2: 0.79, rmse: 0.5, logLik: -10, nobs: 30 },
        { equation: 'b', r2: 0.7, adjR2: 0.69, rmse: 0.6, logLik: -12, nobs: 30 },
        { equation: 'c', r2: 0.6, adjR2: 0.59, rmse: 0.7, logLik: -14, nobs: 30 },
      ],
    })).tables[1]
    expect(t2.spec.columns.map((c) => c.label)).toEqual(['', 'a', 'b', 'c'])
    const gof = t2.rows.filter((r) => r['_kind'] === 'gof')
    expect(gof.find((r) => r.term === 'R²')).toMatchObject({ eq1: '.80', eq2: '.70', eq3: '.60' })
  })
})
