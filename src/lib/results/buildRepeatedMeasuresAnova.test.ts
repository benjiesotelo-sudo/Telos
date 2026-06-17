import { describe, it, expect } from 'vitest'
import { buildRepeatedMeasuresAnova } from './buildRepeatedMeasuresAnova'
import { REPEATED_MEASURES_ANOVA as spec } from '../registry/repeatedMeasuresAnova'
import type { RepeatedMeasuresAnovaResult } from '../stats/repeatedMeasuresAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers (3-measure GG correction, from the plan)
const result3: RepeatedMeasuresAnovaResult = {
  anova: {
    source: 'Condition',
    ss: 1014.1, // approximate; exact value tested via MS = SS/df1
    df1: 1.77543544965388,
    df2: 104.750691529579,
    ms: 1014.1 / 1.77543544965388,
    f: 78.5112991613406,
    p: 3.57330988681511e-20,
    pes: 0.570944348865645,
    pesLow: 0.4755064325, // effectsize::eta_squared(ci=0.95)$CI_low — native R ≡ WebR
    pesHigh: 1,           // one-sided CI: upper bound pinned at 1.00
  },
  sphericity: [
    { effect: 'condition', w: 0.873515789948938, p: 0.0198085203154266, ggEps: 0.88771772482694, hfEps: 0.913297705282412 },
  ],
  desc: [
    { condition: 'score_t1', n: 60, m: 29.5, sd: 4.8 },
    { condition: 'score_t2', n: 60, m: 32.4, sd: 5.1 },
    { condition: 'score_t3', n: 60, m: 35.2, sd: 4.9 },
  ],
  posthoc: [
    { pair: 'score_t1 - score_t2', diff: -2.86333333333332, se: 0.419866582701343, pAdj: 1.63816152413875e-08, ciLo: -3.8979494382861, ciHi: -1.82871722838054 },
    { pair: 'score_t1 - score_t3', diff: -5.72, se: 0.51, pAdj: 0.000000001, ciLo: -6.95, ciHi: -4.50 },
    { pair: 'score_t2 - score_t3', diff: -2.85, se: 0.48, pAdj: 0.0002, ciLo: -4.02, ciHi: -1.68 },
  ],
  sphericityChoice: 'GG correction',
  ciLevel: 0.95,
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

// 2-measure result (sphericity empty, posthoc provided to simulate toggle on)
const result2: RepeatedMeasuresAnovaResult = {
  anova: {
    source: 'Condition',
    ss: 490.3,
    df1: 1,
    df2: 59,
    ms: 490.3,
    f: 55.2,
    p: 0.000000001,
    pes: 0.48,
    pesLow: 0.32,
    pesHigh: 1,
  },
  sphericity: [], // 2 levels → empty
  desc: [
    { condition: 'score_t1', n: 60, m: 29.5, sd: 4.8 },
    { condition: 'score_t2', n: 60, m: 32.4, sd: 5.1 },
  ],
  posthoc: [
    { pair: 'score_t1 - score_t2', diff: -2.9, se: 0.39, pAdj: 0.0000001, ciLo: -3.68, ciHi: -2.12 },
  ],
  sphericityChoice: 'GG correction',
  ciLevel: 0.95,
  alpha: 0.05,
  nExcluded: 2,
  figurePng: png,
}

describe('buildRepeatedMeasuresAnova', () => {
  describe('3-measure GG result', () => {
    const c = buildRepeatedMeasuresAnova(spec, result3)

    it('Table 1: condition descriptives', () => {
      expect(c.tables[0].spec.id).toBe('descriptives')
      expect(c.tables[0].rows[0]).toMatchObject({ condition: 'score_t1', n: 60 })
    })

    it('Table 2: ANOVA row with corrected df (fdf renders fractional dfs)', () => {
      expect(c.tables[1].spec.id).toBe('rm-anova')
      const row = c.tables[1].rows[0]
      expect(row.source).toBe('Condition')
      expect(row.df).toBe('1.78') // fdf(1.77543...) → '1.78'
      expect(row.f).toBe('78.51')
      expect(row.p).toBe('<.001')
      expect(row.pes).toBe('0.57 [0.48, 1.00]') // partial η² with its one-sided CI (upper pinned at 1.00)
    })

    it('Table 3: sphericity table present (3 levels)', () => {
      expect(c.tables[2].spec.id).toBe('sphericity')
      const row = c.tables[2].rows[0]
      expect(row.effect).toBe('condition')
      expect(row.w).toBe('0.87')
      expect(row.gg).toBe('0.89')
      expect(row.hf).toBe('0.91')
    })

    it('Table 4: posthoc comparisons present', () => {
      expect(c.tables[3].spec.id).toBe('posthoc')
      const row = c.tables[3].rows[0]
      expect(row.pair).toBe('score_t1 - score_t2')
      expect(row.mdiff).toBe('−2.86')
      expect(row.se).toBe('0.42')
      expect(row.padj).toBe('<.001')
      expect(row.ci).toBe('[−3.90, −1.83]')
    })

    it('APA string: GG corrected df, F, p < .001, pes without leading zero', () => {
      expect(c.apa).toBe('A repeated-measures ANOVA (GG-corrected) gave F(1.78,104.75)=78.51, p < .001, partial η²=.57 [.48, 1.00].')
    })

    it('note is the assume note with afterTableId=sphericity (note renders between Table 3 and Table 4)', () => {
      expect(c.note).toEqual({ ...spec.tableNote, afterTableId: 'sphericity' })
    })

    it('figure caption and type match spec', () => {
      expect(c.figures[0]).toMatchObject({ caption: 'Means across conditions', type: 'profile plot (means ± CI across conditions)', png })
    })

    it('4 tables total (desc + anova + sphericity + posthoc)', () => {
      expect(c.tables).toHaveLength(4)
    })
  })

  describe('2-measure result (sphericity omitted)', () => {
    const c = buildRepeatedMeasuresAnova(spec, result2)

    it('3 tables: desc + anova + posthoc (NO sphericity table)', () => {
      expect(c.tables).toHaveLength(3)
      expect(c.tables.map((t) => t.spec.id)).toEqual(['descriptives', 'rm-anova', 'posthoc'])
    })

    it('integer df renders without decimals', () => {
      expect(c.tables[1].rows[0].df).toBe('1') // fdf(1) → '1'
    })

    it('nExcluded reflects listwise exclusions', () => {
      expect(c.nExcluded).toBe(2)
    })
  })

  describe('posthoc toggle off (no posthoc rows)', () => {
    const noPosthoc: RepeatedMeasuresAnovaResult = { ...result3, posthoc: [] }
    const c = buildRepeatedMeasuresAnova(spec, noPosthoc)

    it('3 tables: desc + anova + sphericity (no posthoc)', () => {
      expect(c.tables).toHaveLength(3)
      expect(c.tables.map((t) => t.spec.id)).toEqual(['descriptives', 'rm-anova', 'sphericity'])
    })
  })

  describe('sphericityChoice=none (uncorrected run, 3 measures)', () => {
    const resultNone: RepeatedMeasuresAnovaResult = {
      ...result3,
      anova: { ...result3.anova, df1: 2, df2: 118, p: 2.08115277471139e-22 },
      sphericityChoice: 'none',
      posthoc: [],
    }
    const c = buildRepeatedMeasuresAnova(spec, resultNone)

    it('sphericity table is omitted when correction=none', () => {
      expect(c.tables.map((t) => t.spec.id)).toEqual(['descriptives', 'rm-anova'])
    })

    it('APA sentence reads (uncorrected) with integer df', () => {
      expect(c.apa).toContain('(uncorrected)')
      expect(c.apa).toContain('F(2,118)=')
    })

    it('note has afterTableId=rm-anova when correction=none (anchors before posthoc, not after it)', () => {
      expect((c.note as Record<string, unknown>)['afterTableId']).toBe('rm-anova')
    })

    it('note text omits the correction sentence when correction=none', () => {
      expect(c.note!.text).not.toContain('Greenhouse–Geisser')
    })
  })
})
