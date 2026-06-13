import { describe, it, expect } from 'vitest'
import { buildMixedAnova } from './buildMixedAnova'
import { MIXED_ANOVA as spec } from '../registry/mixedAnova'
import type { MixedAnovaResult } from '../stats/mixedAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike known-answer result (GG correction, group × score_t1/t2/t3)
const result: MixedAnovaResult = {
  desc: [
    { group: 'control',  condition: 'score_t1', n: 20, m: 29.45, sd: 4.52 },
    { group: 'control',  condition: 'score_t2', n: 20, m: 32.30, sd: 4.10 },
    { group: 'control',  condition: 'score_t3', n: 20, m: 34.65, sd: 4.80 },
    { group: 'drug_a',   condition: 'score_t1', n: 20, m: 30.82, sd: 4.70 },
    { group: 'drug_a',   condition: 'score_t2', n: 20, m: 33.67, sd: 4.30 },
    { group: 'drug_a',   condition: 'score_t3', n: 20, m: 36.02, sd: 4.90 },
    { group: 'drug_b',   condition: 'score_t1', n: 20, m: 31.05, sd: 4.60 },
    { group: 'drug_b',   condition: 'score_t2', n: 20, m: 33.90, sd: 4.20 },
    { group: 'drug_b',   condition: 'score_t3', n: 20, m: 36.25, sd: 4.95 },
  ],
  anovaRows: [
    { source: 'Group (between)',   ss: 14.22,  df1: 2,              df2: 57,              ms: 7.11,  f: 0.24690089648661,  p: 0.782049251682351,  pes: 0.00858878309615581 },
    { source: 'Condition (within)', ss: 489.30, df1: 1.67166869889464, df2: 95.2851158369946, ms: 292.86, f: 82.5610819498742, p: 1.51705412973608e-19, pes: 0.591576683100862 },
    { source: 'Group × Condition', ss: 29.80,  df1: 3.34333739778929, df2: 95.2851158369946, ms: 8.92,  f: 2.52167386781147,  p: 0.0561473099306867,  pes: 0.0812874855998016 },
  ],
  sphericity: [
    { effect: 'condition',    w: 0.803590686765588, p: 0.00219268908877968, ggEps: 0.835834349447321, hfEps: 0.86 },
    { effect: 'grp:condition', w: 0.803590686765588, p: 0.00219268908877968, ggEps: 0.835834349447321, hfEps: 0.86 },
  ],
  posthoc: [
    { pair: 'score_t1 - score_t2', diff: -2.86333333333332, se: 0.420150001061303, pAdj: 1.9397562305748e-08, ciLo: -3.89971187769057, ciHi: -1.82695478897608 },
    { pair: 'score_t1 - score_t3', diff: -5.73,             se: 0.61,             pAdj: 0.0000001,          ciLo: -7.25,             ciHi: -4.21 },
    { pair: 'score_t2 - score_t3', diff: -2.87,             se: 0.42,             pAdj: 0.000015,           ciLo: -3.90,             ciHi: -1.84 },
  ],
  levene: { F: 0.35, p: 0.71 },
  betweenName: 'Group',
  nExcluded: 0,
  figurePng: png,
}

describe('buildMixedAnova', () => {
  const c = buildMixedAnova(spec, result)

  it('Table 1: descriptives has 9 rows (group × condition cells)', () => {
    expect(c.tables[0].spec.id).toBe('descriptives')
    expect(c.tables[0].rows).toHaveLength(9)
    const first = c.tables[0].rows[0]
    expect(first.group).toBe('control')
    expect(first.condition).toBe('score_t1')
    expect(first.n).toBe(20)
    expect(typeof first.m).toBe('string')  // formatted
    expect(typeof first.sd).toBe('string')
  })

  it('Table 2: ANOVA has three rows with correct sources and formatted values', () => {
    expect(c.tables[1].spec.id).toBe('mixed-anova')
    expect(c.tables[1].rows).toHaveLength(3)
    const [btwn, within, inter] = c.tables[1].rows
    expect(btwn.source).toBe('Group (between)')
    expect(btwn.df).toBe('2')
    expect(btwn.p).toBe('.782')
    expect(within.source).toBe('Condition (within)')
    expect(within.df).toBe('1.67')   // GG-corrected fdf
    expect(within.p).toBe('<.001')
    expect(inter.source).toBe('Group × Condition')
    expect(inter.df).toBe('3.34')
    expect(inter.f).toBe('2.52')
    expect(inter.p).toBe('.056')
    expect(inter.pes).toBe('0.08')
  })

  it('Table 3: sphericity rows present when sphericity array non-empty', () => {
    expect(c.tables[2].spec.id).toBe('sphericity')
    expect(c.tables[2].rows).toHaveLength(2)
    const row = c.tables[2].rows[0]
    expect(row.effect).toBe('condition')
    expect(row.w).toBe('0.80')
    expect(row.p).toBe('.002')
  })

  it('Table 4: posthoc rows present and formatted (U+2212 minuses, CI brackets)', () => {
    expect(c.tables[3].spec.id).toBe('posthoc')
    expect(c.tables[3].rows).toHaveLength(3)
    const ph = c.tables[3].rows[0]
    expect(ph.pair).toBe('score_t1 - score_t2')
    expect(ph.mdiff).toBe('−2.86')  // U+2212
    expect(ph.padj).toBe('<.001')
    expect(ph.ci).toMatch(/^\[−.*\]$/)
  })

  it('APA string is built from the interaction row', () => {
    // F(3.34,95.29)=2.52, p = .056, partial η²=.08 (f01 drops leading zero)
    expect(c.apa).toBe('A mixed ANOVA yielded a Group × Condition interaction, F(3.34,95.29)=2.52, p = .056, partial η²=.08.')
  })

  it('note is assume kind with card text (no Levene parenthetical)', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toBe(spec.tableNote!.text)
    expect(c.note!.text).not.toContain('Levene')
  })

  it('figure has card caption and type', () => {
    expect(c.figures[0].caption).toBe(spec.figures![0].caption)
    expect(c.figures[0].type).toBe(spec.figures![0].type)
    expect(c.figures[0].png).toBe(png)
  })

  it('nExcluded carried through', () => {
    expect(c.nExcluded).toBe(0)
  })

  it('2-level case: sphericity and posthoc tables omitted', () => {
    const r2 = { ...result, sphericity: [], posthoc: [] }
    const c2 = buildMixedAnova(spec, r2)
    // Only 2 tables: descriptives + mixed-anova
    expect(c2.tables).toHaveLength(2)
    expect(c2.tables[0].spec.id).toBe('descriptives')
    expect(c2.tables[1].spec.id).toBe('mixed-anova')
  })

  it('posthoc-off case: only 3 tables (desc, anova, sphericity)', () => {
    const r3 = { ...result, posthoc: [] }
    const c3 = buildMixedAnova(spec, r3)
    expect(c3.tables).toHaveLength(3)
    expect(c3.tables[2].spec.id).toBe('sphericity')
  })
})
