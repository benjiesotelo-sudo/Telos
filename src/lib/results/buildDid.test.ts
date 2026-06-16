import { describe, it, expect } from 'vitest'
import { buildDid } from './buildDid'
import { DID } from '../registry/did'
import type { DidResult } from '../stats/did'

// Numbers verified in native R 4.6.0: plm::plm(roa ~ post + post:treated, model='within') on panel.csv,
// clustered-by-firm SE (plm::vcovHC arellano/HC1). The time-invariant Treated main effect is absorbed.
const mock = (over: Partial<DidResult> = {}): DidResult => ({
  coefRows: [
    { term: 'po', b: 2.015083, se: 0.086275, t: 23.357, p: 1e-30, ciLow: 1.843456, ciHigh: 2.186711 },
    { term: 'po:tr', b: 1.525625, se: 0.116532, t: 13.092, p: 1e-20, ciLow: 1.293806, ciHigh: 1.757444 },
  ],
  seType: 'clustered', ciLevel: 0.95, alpha: 0.05,
  withinR2: 0.8406621, fStat: 216.3148, nObs: 96, nEntities: 12, nExcluded: 0,
  figTrendsPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildDid', () => {
  it('stacks B / (clustered SE) / [CI] per term and shows only Post + Treated × Post (Treated absorbed)', () => {
    const c = buildDid(DID, mock())
    expect(c.tables).toHaveLength(1) // one merged stacked table
    expect(c.tables[0].rows.slice(0, 6)).toEqual([
      { _kind: 'coef', term: 'Post', est: '2.02' },
      { _kind: 'se', term: '', est: '(0.09)' },
      { _kind: 'ci', term: '', est: '[1.84, 2.19]' },
      { _kind: 'coef', term: 'Treated × Post', est: '1.53' },
      { _kind: 'se', term: '', est: '(0.12)' },
      { _kind: 'ci', term: '', est: '[1.29, 1.76]' },
    ])
  })

  it('merges Model fit into the panel GOF footer (Num.Obs., N entities, Within R², F) — no AIC/BIC/Log.Lik', () => {
    const c = buildDid(DID, mock())
    const rows = c.tables[0].rows
    expect(rows.find((x) => x._kind === 'rule')).toBeDefined()
    const gof = rows.filter((x) => x._kind === 'gof')
    expect(gof).toEqual([
      { _kind: 'gof', term: 'Num.Obs.', est: '96' },
      { _kind: 'gof', term: 'N entities', est: '12' },
      { _kind: 'gof', term: 'Within R²', est: '.84' },
      { _kind: 'gof', term: 'F', est: '216.31' },
    ])
  })

  it('APA reports the DiD interaction estimate (report-only, literal 95% CI, clustered SE)', () => {
    expect(buildDid(DID, mock()).apa).toBe('The DiD estimate was B=1.53, 95% CI [1.29, 1.76], p < .001 (clustered SE).')
  })

  it('threads the CI level into the note (no CI column header survives)', () => {
    expect(buildDid(DID, mock({ ciLevel: 0.9 })).note!.text).toContain('the bracketed line is the 90% CI')
    expect(buildDid(DID, mock()).note!.text).toContain('the bracketed line is the 95% CI')
  })

  it('renders the drawn parallel-trends + absorbed-Treated note, the SE-type wording, and the α in how-to-read', () => {
    const c = buildDid(DID, mock())
    expect(c.note!.text).toContain('the time-invariant Treated main effect is absorbed (only Post and Treated×Post are estimated)')
    expect(c.note!.text).toContain('Standard errors in parentheses are clustered by entity')
    expect(c.howToRead).toContain('Your significance threshold (α) is 0.05.')
  })

  it('reflects classical SEs in the note + APA when chosen (not hardcoded "clustered")', () => {
    const c = buildDid(DID, mock({ seType: 'classical' }))
    expect(c.note!.text).toContain('Standard errors in parentheses are classical')
    expect(c.note!.text).not.toContain('clustered by entity')
    expect(c.apa).toContain('(classical SE)')
    expect(c.apa).not.toContain('(clustered SE)')
  })
})
