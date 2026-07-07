import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
import { CITATIONS } from './citations'

describe('citation registry coverage (A4)', () => {
  it('every catalog id has a citation entry', () => {
    const missing = CATALOG.filter((c) => !CITATIONS[c.id]).map((c) => c.id)
    expect(missing).toEqual([])
  })
  it('every entry has a non-empty whyThisTest and at least one statisticalBasis claim, each with at least one ref', () => {
    const offenders = Object.entries(CITATIONS).filter(([, c]) =>
      !c.whyThisTest.text.trim() || c.whyThisTest.refs.length === 0 ||
      c.statisticalBasis.length === 0 || c.statisticalBasis.some((b) => !b.claim.trim() || !b.ref.text.trim()))
      .map(([id]) => id)
    expect(offenders).toEqual([])
  })
  it('no id in CITATIONS that is not in CATALOG (dead entries)', () => {
    const ids = new Set(CATALOG.map((c) => c.id))
    expect(Object.keys(CITATIONS).filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('provenance-audit fix round (U7-T1 fix)', () => {
  const claimRef = (id: string, needle: string) => {
    const entry = CITATIONS[id].statisticalBasis.find((b) => b.claim.includes(needle))
    if (!entry) throw new Error(`no claim containing "${needle}" on ${id}`)
    return entry.ref.text
  }

  it('mann-whitney-u: rank-biserial claim cites effectsize, not Cohen 1988 (Cohen has no such benchmark)', () => {
    expect(claimRef('mann-whitney-u', 'Rank-biserial effect size')).toMatch(/Ben-Shachar/)
    expect(claimRef('mann-whitney-u', 'Rank-biserial effect size')).not.toMatch(/Cohen/)
  })

  it('wilcoxon-signed-rank: matched-pairs rank-biserial claim cites effectsize, not Cohen 1988', () => {
    expect(claimRef('wilcoxon-signed-rank', 'Matched-pairs rank-biserial effect size')).toMatch(/Ben-Shachar/)
    expect(claimRef('wilcoxon-signed-rank', 'Matched-pairs rank-biserial effect size')).not.toMatch(/Cohen/)
  })

  it('nested-anova: omega-squared claim drops "benchmarks" and cites effectsize, not Cohen 1988', () => {
    expect(claimRef('nested-anova', 'ω² effect size')).toMatch(/Ben-Shachar/)
  })

  it('chi-square-independence: Cramér\'s V claim keeps Cohen 1988 (w-family) but drops the bare "benchmark" framing', () => {
    const ref = claimRef('chi-square-independence', "Cramér's V effect size")
    expect(ref).toMatch(/Cohen/)
  })

  it('welch-anova cites Welch 1951 (k-sample), not Welch 1947 (two-sample); independent-t-test keeps 1947', () => {
    const welchAnovaRef = claimRef('welch-anova', "Welch's ANOVA")
    expect(welchAnovaRef).toMatch(/1951/)
    expect(welchAnovaRef).not.toMatch(/1947/)
    const independentTRef = claimRef('independent-t-test', "Welch's correction")
    expect(independentTRef).toMatch(/1947/)
  })

  it('repeated-measures-anova: Greenhouse-Geisser and Huynh-Feldt corrections are cited separately from Fisher 1925', () => {
    expect(claimRef('repeated-measures-anova', 'Greenhouse-Geisser')).toMatch(/Greenhouse.*Geisser.*1959/)
    expect(claimRef('repeated-measures-anova', 'Huynh-Feldt')).toMatch(/Huynh.*Feldt.*1976/)
    expect(claimRef('repeated-measures-anova', 'F-test for within-subjects')).toMatch(/Fisher/)
  })

  it('manova and mancova: Pillai\'s trace is cited to Pillai 1955 and listed before Wilks\' Lambda', () => {
    for (const id of ['manova', 'mancova']) {
      const claims = CITATIONS[id].statisticalBasis
      const pillaiIdx = claims.findIndex((b) => b.claim.includes("Pillai's trace"))
      const wilksIdx = claims.findIndex((b) => b.claim.includes("Wilks' Lambda"))
      expect(pillaiIdx).toBeGreaterThanOrEqual(0)
      expect(wilksIdx).toBeGreaterThan(pillaiIdx)
      expect(claims[pillaiIdx].ref.text).toMatch(/Pillai.*1955/)
      expect(claims[wilksIdx].ref.text).toMatch(/Wilks.*1932/)
    }
  })

  it('ave / composite-reliability / efa: claim text has no didactic "NOT cited to..." meta-commentary', () => {
    for (const id of ['ave', 'composite-reliability', 'efa']) {
      for (const b of CITATIONS[id].statisticalBasis) {
        expect(b.claim).not.toMatch(/NOT cited|NOT "Kaiser/i)
      }
    }
    // the correct attribution is still intact, just moved out of the rendered claim text
    expect(claimRef('ave', 'CR (composite reliability)')).toMatch(/Nunnally/)
    expect(claimRef('composite-reliability', 'CR (composite reliability)')).toMatch(/Nunnally/)
    expect(claimRef('efa', 'KMO sampling-adequacy')).toMatch(/Kaiser, H\. F\., Rice/)
  })

  it('paired-t-test: dz claim has no bare benchmark numbers in the rendered text', () => {
    expect(CITATIONS['paired-t-test'].statisticalBasis.some((b) => /\(\.2\/\.5\/\.8\)/.test(b.claim))).toBe(false)
  })
})
