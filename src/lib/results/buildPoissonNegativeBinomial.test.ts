import { describe, it, expect } from 'vitest'
import { buildPoissonNegativeBinomial } from './buildPoissonNegativeBinomial'
import { POISSON_NEGATIVE_BINOMIAL } from '../registry/poissonNegativeBinomial'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (poisson-nb.csv, pooff_ keys — Poisson with offset).
const poisson: PoissonNbResult = { outcome: 'complaints', model: 'Poisson',
  aic: 202.368510500, deviance: 67.565463040, dfResid: 37, dispersion: 1.686886555,
  terms: [
    { term: '(Intercept)', b: -1.463347276, se: 0.234537250, z: -6.239295777, p: 4.395451914e-10, irr: 0.231460215, irrLow: 0.145023055, irrHigh: 0.363902957 },
    { term: 'age', b: 0.013258484, se: 0.004919987, z: 2.694820707, p: 0.007042652, irr: 1.013346767, irrLow: 1.003600186, irrHigh: 1.023164956 },
    { term: 'group: b', b: 0.173785589, se: 0.139443640, z: 1.246278344, p: 0.212662225, irr: 1.189800432, irrLow: 0.903978021, irrHigh: 1.562820565 },
  ],
  ciLevel: 0.95, n: 40, nExcluded: 0, figResidualsPng: png }
// nboff_ keys — negative binomial with offset: the Dispersion cell carries theta.
const negbin: PoissonNbResult = { ...poisson, model: 'negative binomial',
  aic: 200.096113400, deviance: 45.810830490, dispersion: 9.000773027,
  terms: [
    { term: '(Intercept)', b: -1.468307103, se: 0.293799781, z: -4.997645325, p: 5.803459981e-7, irr: 0.230315055, irrLow: 0.129237738, irrHigh: 0.406340052 },
    { term: 'age', b: 0.013198238, se: 0.006246859, z: 2.112779763, p: 0.034619623, irr: 1.013285719, irrLow: 1.001024427, irrHigh: 1.025753033 },
    { term: 'group: b', b: 0.182543786, se: 0.177552067, z: 1.028114113, p: 0.303896153, irr: 1.200266705, irrLow: 0.847592634, irrHigh: 1.699016754 },
  ] }

describe('buildPoissonNegativeBinomial', () => {
  it('Poisson: Dispersion cell = Pearson ratio; coefficient rows with IRR + profile CI', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson)
    expect(c.tables[0].rows).toEqual([{ aic: '202.37', dev: '67.57', df: '37', dispersion: '1.69' }])
    expect(c.tables[1].rows[1]).toEqual({ term: 'age', b: '0.01', se: '0.005', z: '2.69', p: '.007', irr: '1.01', ci: '[1.00, 1.02]' })
    expect(c.tables[1].rows[0]).toMatchObject({ term: '(Intercept)', b: '−1.46', z: '−6.24', p: '<.001' })
    expect(c.note).toEqual(POISSON_NEGATIVE_BINOMIAL.tableNote) // card-literal/static
  })
  it('negative binomial: the SAME Dispersion cell carries theta (convention 10 / recorded decision 10)', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, negbin)
    expect(c.tables[0].rows).toEqual([{ aic: '200.10', dev: '45.81', df: '37', dispersion: '9.00' }])
    expect(c.tables[1].rows[2]).toEqual({ term: 'group: b', b: '0.18', se: '0.18', z: '1.03', p: '.304', irr: '1.20', ci: '[0.85, 1.70]' })
  })
  it('APA: card-literal wording, Predictor X = first coefficient row', () => {
    expect(buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson).apa)
      .toBe('Predictor age was associated with the count, IRR=1.01, 95% CI [1.00, 1.02], p = .007.')
  })
})
