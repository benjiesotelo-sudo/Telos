import { describe, it, expect } from 'vitest'
import { buildAve } from './buildAve'
import type { AveResult } from '../stats/runAve'
import { AVE } from '../registry/ave'

// Audit gap (2026-07-06 completeness audit, ave row): the APA sentence asserted "was supported" /
// "held" unconditionally regardless of the actual AVE/CR/HTMT values. The registry template now carries
// {convVerdict}/{discVerdict} tokens; the builder must condition them on THIS run's own numbers.
const twoConstructOk: AveResult = {
  cfa: {
    perConstruct: [
      { name: 'visual', ave: 0.61, cr: 0.85, omega: 0.85, alpha: 0.8 },
      { name: 'textual', ave: 0.72, cr: 0.9, omega: 0.9, alpha: 0.88 },
    ],
    fornellLarcker: [
      [0.78, 0.46],
      [0.46, 0.85],
    ],
    htmt: [
      [1, 0.38],
      [0.38, 1],
    ],
    labels: ['visual', 'textual'],
    corLvP: [
      [null, 0.0001],
      [0.0001, null],
    ] as unknown as number[][],
  },
  figValidityPng: new Uint8Array(),
}

describe('buildAve — APA verdict conditioned on the live AVE/CR/HTMT values (not hardcoded)', () => {
  it('reports both clauses supported/held when every construct clears AVE>=.50, CR>=.70, and HTMT<.85', () => {
    const c = buildAve(AVE, twoConstructOk)
    expect(c.apa).toContain('Convergent validity was supported')
    expect(c.apa).toContain('discriminant validity held')
  })

  it('flags convergent validity as not fully supported when a construct falls below AVE .50', () => {
    const lowAve: AveResult = {
      ...twoConstructOk,
      cfa: { ...twoConstructOk.cfa, perConstruct: [{ name: 'visual', ave: 0.41, cr: 0.85, omega: 0.85, alpha: 0.8 }, twoConstructOk.cfa.perConstruct[1]] },
    }
    const c = buildAve(AVE, lowAve)
    expect(c.apa).toContain('Convergent validity was not fully supported')
    expect(c.apa).not.toContain('Convergent validity was supported')
  })

  it('flags discriminant validity as not holding when an HTMT cell is >= .85', () => {
    const highHtmt: AveResult = {
      ...twoConstructOk,
      cfa: { ...twoConstructOk.cfa, htmt: [[1, 0.91], [0.91, 1]] },
    }
    const c = buildAve(AVE, highHtmt)
    expect(c.apa).toContain('discriminant validity did not hold')
  })

  it('with only 1 construct (no HTMT computed), does not assert an unearned discriminant-validity claim', () => {
    const oneConstruct: AveResult = {
      ...twoConstructOk,
      cfa: { perConstruct: [twoConstructOk.cfa.perConstruct[0]], fornellLarcker: [[0.78]], htmt: [[1]], labels: ['visual'], corLvP: [[null]] as unknown as number[][] },
    }
    const c = buildAve(AVE, oneConstruct)
    expect(c.apa).not.toContain('discriminant validity held')
    expect(c.apa).not.toContain('{discVerdict}')
    expect(c.apa).toMatch(/not assessed/)
  })

  it('every {token} in the template resolves to a live value (no literal braces survive)', () => {
    const c = buildAve(AVE, twoConstructOk)
    expect(c.apa).not.toMatch(/\{[a-zA-Z]+\}/)
  })
})
