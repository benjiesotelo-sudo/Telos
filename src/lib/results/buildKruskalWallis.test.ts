import { describe, it, expect } from 'vitest'
import { buildKruskalWallis } from './buildKruskalWallis'
import { KRUSKAL_WALLIS as spec } from '../registry/kruskalWallis'
import type { KruskalWallisResult } from '../stats/kruskalWallis'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const spikeResult: KruskalWallisResult = {
  ranks: [
    { group: 'control', n: 20, meanRank: 24.9 },
    { group: 'drug_a', n: 20, meanRank: 28.15 },
    { group: 'drug_b', n: 20, meanRank: 38.45 },
  ],
  h: 6.56495733622387,
  df: 2,
  p: 0.0375351043416359,
  eps2: 0.111270463325828,
  posthoc: [
    { pair: 'control - drug_a', z: 0.588572301903464, pAdj: 0.556148218919164 },
    { pair: 'control - drug_b', z: 2.4538937510129, pAdj: 0.0423956188352741 },
    { pair: 'drug_a - drug_b', z: 1.86532144910944, pAdj: 0.124272720791776 },
  ],
  nExcluded: 0,
  figurePng: png,
}

describe('buildKruskalWallis', () => {
  const c = buildKruskalWallis(spec, spikeResult)

  it('Table 1: rank summary rows with meanRank at 2 dp', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { group: 'control', n: 20, meanRank: '24.90' },
      { group: 'drug_a', n: 20, meanRank: '28.15' },
      { group: 'drug_b', n: 20, meanRank: '38.45' },
    ])
  })

  it('Table 2: Kruskal-Wallis row — H · df · p · eps2', () => {
    expect(c.tables[1].spec.id).toBe('kruskal-wallis')
    expect(c.tables[1].rows).toEqual([{ h: '6.56', df: '2', p: '.038', eps2: '0.11' }])
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

  it('APA string matches the spike numbers', () => {
    expect(c.apa).toBe('A Kruskal-Wallis test found a difference, H(2)=6.56, p=.038, &epsilon;&sup2;=0.11.')
  })

  it('p<.001 branch flips correctly', () => {
    const c2 = buildKruskalWallis(spec, { ...spikeResult, p: 0.0005 })
    expect(c2.apa).toContain('p<.001')
    expect(c2.tables[1].rows[0].p).toBe('<.001')
  })

  it('nExcluded is carried through', () => {
    expect(c.nExcluded).toBe(0)
    const c2 = buildKruskalWallis(spec, { ...spikeResult, nExcluded: 3 })
    expect(c2.nExcluded).toBe(3)
  })
})
