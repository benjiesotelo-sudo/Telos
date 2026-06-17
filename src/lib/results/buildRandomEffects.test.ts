import { describe, it, expect } from 'vitest'
import { buildRandomEffects } from './buildRandomEffects'
import { RANDOM_EFFECTS } from '../registry/randomEffects'
import type { RandomEffectsResult } from '../stats/randomEffects'

const mock = (over: Partial<RandomEffectsResult> = {}): RandomEffectsResult => ({
  coefRows: [
    { term: '(Intercept)', b: -0.76547, se: 0.276531, t: -2.768113, p: 0.006818, ciLow: -1.314685, ciHigh: -0.216255 },
    { term: 'leverage', b: -4.053601, se: 1.289718, t: -3.143013, p: 0.002251, ciLow: -6.615093, ciHigh: -1.49211 },
    { term: 'rd_spend', b: 0.547641, se: 0.155511, t: 3.52156, p: 0.00067, ciLow: 0.238783, ciHigh: 0.856499 },
    { term: 'size', b: 0.956744, se: 0.047436, t: 20.169133, p: 1e-9, ciLow: 0.862532, ciHigh: 1.050956 },
  ],
  r2: 0.98005, adjR2: 0.9793994, nObs: 96, nEntities: 12,
  bpLm: 0.06952968, bpDf: 1, bpP: 0.7920228,
  theta: 0.0420548809841274, varIdiosyncratic: 0.2500838, varEntity: 0.00280499,
  seType: 'clustered', ciLevel: 0.95, alpha: 0.05, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildRandomEffects', () => {
  it('stacks B / (clustered SE) / [CI] per term, drops t/p from the cell (D1)', () => {
    const rows = buildRandomEffects(RANDOM_EFFECTS, mock()).tables[0].rows
    // intercept block
    expect(rows[0]).toEqual({ _kind: 'coef', term: '(Intercept)', est: '−0.77' })
    expect(rows[1]).toEqual({ _kind: 'se', term: '', est: '(0.28)' })
    expect(rows[2]).toEqual({ _kind: 'ci', term: '', est: '[−1.31, −0.22]' })
    // last slope block (size)
    expect(rows[9]).toEqual({ _kind: 'coef', term: 'size', est: '0.96' })
    expect(rows[10]).toEqual({ _kind: 'se', term: '', est: '(0.05)' })
    expect(rows[11]).toEqual({ _kind: 'ci', term: '', est: '[0.86, 1.05]' })
  })
  it('rule then a GOF footer merging Num.Obs./N entities/R²/R² Adj. (no F, no AIC/BIC/Log.Lik.)', () => {
    const rows = buildRandomEffects(RANDOM_EFFECTS, mock()).tables[0].rows
    expect(rows[12]).toEqual({ _kind: 'rule' })
    expect(rows.slice(13)).toEqual([
      { _kind: 'gof', term: 'Num.Obs.', est: '96' },
      { _kind: 'gof', term: 'N entities', est: '12' },
      { _kind: 'gof', term: 'R²', est: '0.98' },
      { _kind: 'gof', term: 'R² Adj.', est: '0.98' },
    ])
  })
  it('single coef table — the separate model-fit table is merged in', () => {
    expect(buildRandomEffects(RANDOM_EFFECTS, mock()).tables).toHaveLength(1)
  })
  it('APA names the first SLOPE (not the intercept), report-only', () => {
    expect(buildRandomEffects(RANDOM_EFFECTS, mock()).apa)
      .toBe('In a random-effects model, predictor leverage gave B=−4.05, p = .002.')
  })
  it('how-to-read appends the α line, unchanged from the spec wording', () => {
    expect(buildRandomEffects(RANDOM_EFFECTS, mock({ alpha: 0.05 })).howToRead)
      .toBe(RANDOM_EFFECTS.howToRead + ' Your significance threshold (α) is 0.05.')
  })

  // Theme-4: the BP LM test (RE vs pooled OLS) + variance components / theta append to the drawn table note.
  it('appends the Breusch–Pagan LM test (RE vs pooled OLS) to the table note', () => {
    const note = buildRandomEffects(RANDOM_EFFECTS, mock()).note!
    expect(note.text).toContain(RANDOM_EFFECTS.tableNote!.text)
    expect(note.text).toContain('Breusch–Pagan LM test')
    expect(note.text).toContain('χ²(1) = 0.07, p = .792')
  })
  it('appends the Swamy–Arora variance components + theta to the table note', () => {
    const note = buildRandomEffects(RANDOM_EFFECTS, mock()).note!
    expect(note.text).toContain('θ = 0.04')
    expect(note.text).toContain('idiosyncratic 0.25')
    expect(note.text).toContain('between 0.00')
  })
  it('guards a missing BP LM / theta to an em-dash (no NaN leaks)', () => {
    const note = buildRandomEffects(RANDOM_EFFECTS, mock({ bpLm: null, bpDf: null, bpP: null, theta: null, varIdiosyncratic: null, varEntity: null })).note!
    expect(note.text).toContain('Breusch–Pagan LM test (RE vs pooled OLS): —')
    expect(note.text).toContain('Swamy–Arora —')
    expect(note.text).not.toMatch(/NaN/)
  })
})
