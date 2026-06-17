import { describe, it, expect } from 'vitest'
import { buildKruskalWallis } from './buildKruskalWallis'
import { KRUSKAL_WALLIS as spec } from '../registry/kruskalWallis'
import type { KruskalWallisResult } from '../stats/kruskalWallis'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const spikeResult: KruskalWallisResult = {
  ranks: [
    { group: 'control', n: 20, median: 33.55, iqr: 9.625, meanRank: 24.9 },
    { group: 'drug_a', n: 20, median: 36.5, iqr: 11.975, meanRank: 28.15 },
    { group: 'drug_b', n: 20, median: 38.7, iqr: 6.6, meanRank: 38.45 },
  ],
  h: 6.56495733622387,
  df: 2,
  p: 0.0375351043416359,
  eps2: 0.111270463325828,
  eps2Low: 0.0257699314, eps2High: 1, // effectsize::rank_epsilon_squared(ci=0.95) set.seed(42) — one-sided, upper pinned at 1.00
  posthoc: [
    { pair: 'control - drug_a', z: 0.588572301903464, pAdj: 0.556148218919164 },
    { pair: 'control - drug_b', z: 2.4538937510129, pAdj: 0.0423956188352741 },
    { pair: 'drug_a - drug_b', z: 1.86532144910944, pAdj: 0.124272720791776 },
  ],
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildKruskalWallis', () => {
  const c = buildKruskalWallis(spec, spikeResult)

  it('Table 1: rank summary rows with median, IQR, meanRank at 2 dp', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { group: 'control', n: 20, median: '33.55', iqr: '9.63', meanRank: '24.90' },
      { group: 'drug_a', n: 20, median: '36.50', iqr: '11.97', meanRank: '28.15' },
      { group: 'drug_b', n: 20, median: '38.70', iqr: '6.60', meanRank: '38.45' },
    ])
  })

  it('Table 1: median/IQR fall back to em-dash when null', () => {
    const c2 = buildKruskalWallis(spec, {
      ...spikeResult,
      ranks: [{ group: 'x', n: 1, median: null as unknown as number, iqr: null as unknown as number, meanRank: 1 }],
    })
    expect(c2.tables[0].rows[0]).toEqual({ group: 'x', n: 1, median: '—', iqr: '—', meanRank: '1.00' })
  })

  it('Table 2: Kruskal-Wallis row — H · df · p · eps2 [95% CI]', () => {
    expect(c.tables[1].spec.id).toBe('kruskal-wallis')
    expect(c.tables[1].rows).toEqual([{ h: '6.56', df: '2', p: '.038', eps2: '0.11 [0.03, 1.00]' }])
  })

  it('Table 3: Dunn post-hoc rows — pair · Z · padj', () => {
    expect(c.tables[2].spec.id).toBe('posthoc')
    expect(c.tables[2].rows[0]).toEqual({ pair: 'control - drug_a', z: '0.59', padj: '.556' })
    expect(c.tables[2].rows[1]).toEqual({ pair: 'control - drug_b', z: '2.45', padj: '.042' })
    expect(c.tables[2].rows[2]).toEqual({ pair: 'drug_a - drug_b', z: '1.87', padj: '.124' })
  })

  it('note is null (no table note on this card)', () => {
    expect(c.note).toBeNull()
  })

  it('figure carries the boxplot caption and PNG', () => {
    expect(c.figures).toEqual([{ caption: 'Distribution by group', type: 'boxplot', png }])
  })

  it('APA string matches the spike numbers — ε² reported with its [95% CI]', () => {
    expect(c.apa).toBe('A Kruskal-Wallis test gave H(2)=6.56, p = .038, ε²=.11 [.03, 1.00].')
  })

  it('p<.001 branch flips correctly', () => {
    const c2 = buildKruskalWallis(spec, { ...spikeResult, p: 0.0005 })
    expect(c2.apa).toContain('p < .001')
    expect(c2.tables[1].rows[0].p).toBe('<.001')
  })

  it('nExcluded is carried through', () => {
    expect(c.nExcluded).toBe(0)
    const c2 = buildKruskalWallis(spec, { ...spikeResult, nExcluded: 3 })
    expect(c2.nExcluded).toBe(3)
  })
})
