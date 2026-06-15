import { describe, it, expect } from 'vitest'
import { buildDid } from './buildDid'
import { DID } from '../registry/did'
import type { DidResult } from '../stats/did'

const mock = (over: Partial<DidResult> = {}): DidResult => ({
  coefRows: [
    { term: '(Intercept)', b: 19.206417, se: 0.779187, t: 24.649311, p: 1e-30, ciLow: 17.658885, ciHigh: 20.753949 },
    { term: 'tr', b: -6.2865, se: 1.099424, t: -5.717996, p: 1e-7, ciLow: -8.47005, ciHigh: -4.10295 },
    { term: 'po', b: 2.015083, se: 0.090609, t: 22.239241, p: 1e-30, ciLow: 1.835125, ciHigh: 2.195041 },
    { term: 'tr:po', b: 1.525625, se: 0.122387, t: 12.465601, p: 1e-20, ciLow: 1.282554, ciHigh: 1.768696 },
  ],
  seType: 'clustered', ciLevel: 0.95, alpha: 0.05, nObs: 96, nExcluded: 0,
  figTrendsPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildDid', () => {
  it('relabels the model terms to Treated / Post / Treated × Post', () => {
    const c = buildDid(DID, mock())
    expect(c.tables[0].rows.map((r) => r.term)).toEqual(['Intercept', 'Treated', 'Post', 'Treated × Post'])
    expect(c.tables[0].rows[3]).toEqual({ term: 'Treated × Post', b: '1.53', se: '0.12', t: '12.47', p: '<.001', ci: '[1.28, 1.77]' })
  })
  it('APA reports the DiD interaction estimate with literal 95% CI (report-only)', () => {
    expect(buildDid(DID, mock()).apa).toBe('The DiD estimate was B=1.53, 95% CI [1.28, 1.77], p < .001 (clustered SE).')
  })
  it('threads a non-default CI level into the column header (APA uses literal 95% CI)', () => {
    const c = buildDid(DID, mock({ ciLevel: 0.9 }))
    // APA template has literal "95% CI" — not threaded; column label still updates from ciLevel
    expect(c.tables[0].spec.columns.find((col) => col.key === 'ci')!.label).toBe('90% CI')
  })
})
