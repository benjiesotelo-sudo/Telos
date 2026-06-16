import { describe, it, expect } from 'vitest'
import { buildPoissonNegativeBinomial } from './buildPoissonNegativeBinomial'
import { POISSON_NEGATIVE_BINOMIAL } from '../registry/poissonNegativeBinomial'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (regression.csv, complaints ~ age + group, Poisson WITH offset(log(months_observed))).
// GOF verified in native R 4.6.0: AIC 202.3685105 · BIC 207.4351488 · logLik −98.18425523 · dev 67.56546304 · disp 1.686886555.
const poisson: PoissonNbResult = { outcome: 'complaints', model: 'Poisson',
  aic: 202.368510500, bic: 207.435148800, logLik: -98.184255230, deviance: 67.565463040, dfResid: 37, dispersion: 1.686886555,
  terms: [
    { term: '(Intercept)', b: -1.463347276, se: 0.234537250, z: -6.239295777, p: 4.395451914e-10, irr: 0.231460215, irrLow: 0.145023055, irrHigh: 0.363902957 },
    { term: 'age', b: 0.013258484, se: 0.004919987, z: 2.694820707, p: 0.007042652, irr: 1.013346767, irrLow: 1.003600186, irrHigh: 1.023164956 },
    { term: 'group: b', b: 0.173785589, se: 0.139443640, z: 1.246278344, p: 0.212662225, irr: 1.189800432, irrLow: 0.903978021, irrHigh: 1.562820565 },
  ],
  ciLevel: 0.95, alpha: 0.05, n: 40, nExcluded: 0, figResidualsPng: png }
// negative binomial WITH offset: the Dispersion footer carries theta; GOF verified in native R 4.6.0:
// AIC 200.0961134 · BIC 206.8516312 (theta = 4th param) · logLik −96.04805671 · dev 45.81083049 · theta 9.000773027.
const negbin: PoissonNbResult = { ...poisson, model: 'negative binomial',
  aic: 200.096113400, bic: 206.851631200, logLik: -96.048056710, deviance: 45.810830490, dispersion: 9.000773027,
  terms: [
    { term: '(Intercept)', b: -1.468307103, se: 0.293799781, z: -4.997645325, p: 5.803459981e-7, irr: 0.230315055, irrLow: 0.129237738, irrHigh: 0.406340052 },
    { term: 'age', b: 0.013198238, se: 0.006246859, z: 2.112779763, p: 0.034619623, irr: 1.013285719, irrLow: 1.001024427, irrHigh: 1.025753033 },
    { term: 'group: b', b: 0.182543786, se: 0.177552067, z: 1.028114113, p: 0.303896153, irr: 1.200266705, irrLow: 0.847592634, irrHigh: 1.699016754 },
  ] }

// Row layout (SHAPE A, exponentiated two-column B | IRR): per term a coef row (B, IRR) then a muted (SE)|[CI] row;
// 3 terms → 6 stacked rows, then a {_kind:'rule'} row, then 7 gof rows. No significance stars (D1); z/p drop from the cell.
describe('buildPoissonNegativeBinomial — modelsummary SHAPE A (B | IRR)', () => {
  it('Poisson: coef row carries B + IRR; muted row = (SE) under B, IRR CI under IRR', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson)
    const rows = c.tables[0].rows
    expect(rows.length).toBe(3 * 2 + 1 + 7) // 6 stacked term rows + rule + 7 gof
    // age term (2nd): coef row B + IRR, then muted (SE) | [IRR CI] — z/p absent from the visible cells.
    expect(rows[2]).toEqual({ _kind: 'coef', term: 'age', b: '0.01', irr: '1.01' })
    expect(rows[3]).toEqual({ _kind: 'se', term: '', b: '(0.005)', irr: '[1.00, 1.02]' })
    // intercept term (1st): negative B keeps the minus sign, IRR exponentiated.
    expect(rows[0]).toEqual({ _kind: 'coef', term: '(Intercept)', b: '−1.46', irr: '0.23' })
    expect(rows[1]).toEqual({ _kind: 'se', term: '', b: '(0.23)', irr: '[0.15, 0.36]' })
  })
  it('Poisson GOF footer (glm family): Num.Obs. → Dispersion → Residual deviance → df → Log.Lik. → AIC → BIC', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson)
    const gof = c.tables[0].rows.filter((r) => r._kind === 'gof')
    expect(gof.map((g) => [g.term, g.b])).toEqual([
      ['Num.Obs.', '40'], ['Dispersion', '1.69'], ['Residual deviance', '67.57'],
      ['df', '37'], ['Log.Lik.', '−98.18'], ['AIC', '202.37'], ['BIC', '207.44'],
    ])
    expect(c.tables[0].rows.some((r) => r._kind === 'rule')).toBe(true)
    expect(c.note).toEqual(POISSON_NEGATIVE_BINOMIAL.tableNote) // Poisson keeps the card-literal dispersion note
  })
  it('negative binomial: the SAME Dispersion footer carries theta (convention 10 / recorded decision 10)', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, negbin)
    const gof = c.tables[0].rows.filter((r) => r._kind === 'gof')
    expect(gof.find((g) => g.term === 'Dispersion')!.b).toBe('9.00') // theta
    expect(gof.find((g) => g.term === 'BIC')!.b).toBe('206.85')      // counts theta as a 4th param
    expect(gof.find((g) => g.term === 'Log.Lik.')!.b).toBe('−96.05')
    // group: b coef row + IRR with its CI beneath
    const rows = c.tables[0].rows
    expect(rows[4]).toEqual({ _kind: 'coef', term: 'group: b', b: '0.18', irr: '1.20' })
    expect(rows[5]).toEqual({ _kind: 'se', term: '', b: '(0.18)', irr: '[0.85, 1.70]' })
  })
  it('negative binomial: note describes theta instead of Poisson switch advice', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, negbin)
    expect(c.note!.text).toContain('theta')
    expect(c.note!.text).not.toContain('switch to negative binomial')
  })
  it('APA: card-literal wording, Predictor X = first coefficient row, report-only (no verdict)', () => {
    expect(buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson).apa)
      .toBe('Predictor age was associated with the count, IRR=1.01, 95% CI [1.00, 1.02], p = .007.')
  })
})
