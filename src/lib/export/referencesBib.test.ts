import { describe, it, expect } from 'vitest'
import { referencesBibText } from './referencesBib'
import type { TestSetup } from '../../state/session'

// Tiny validity check per the brief: balanced braces + exactly one '@' per entry (not a full BibTeX
// parser — the kit's bib is a best-effort mechanical export, not a hand-authored bibliography).
function assertValidBib(bib: string) {
  const opens = (bib.match(/\{/g) ?? []).length
  const closes = (bib.match(/\}/g) ?? []).length
  expect(opens).toBe(closes)
  const entries = bib.split(/\n\s*\n/).filter((e) => e.trim())
  for (const entry of entries) {
    expect(entry.match(/@/g)?.length ?? 0).toBe(1)
    expect(entry.trim().startsWith('@')).toBe(true)
  }
}

describe('referencesBibText', () => {
  it('produces valid-shaped BibTeX (balanced braces, one @ per entry) for an empty selection', () => {
    assertValidBib(referencesBibText([]))
  })

  it('always includes the app entry (tier 1)', () => {
    const bib = referencesBibText([])
    expect(bib).toContain('@misc{')
    expect(bib).toContain('Sotelo, B.')
  })

  it('includes one deduped entry for a ref shared by two selected tests, and stays valid', () => {
    const bib = referencesBibText(['one-sample-t-test', 'pearson'])
    assertValidBib(bib)
    const occurrences = bib.split('Cohen, J.').length - 1
    expect(occurrences).toBe(1)
  })

  it('gives every entry a unique citekey even when two refs share the same first-author + year', () => {
    // Marsh, Hau, Wen (2004) and Marsh, Wen, Hau (2004) are both real, distinct papers cited on cb-sem.
    const bib = referencesBibText(['cb-sem'])
    assertValidBib(bib)
    const keys = [...bib.matchAll(/@misc\{([^,]+),/g)].map((m) => m[1])
    expect(new Set(keys).size).toBe(keys.length)
  })

  // Task 8: conditional method refs are picked up through the SAME dedup/bib-entry pipeline.
  it('a default (untouched) cb-sem run has no setups arg needed and mentions no conditional refs', () => {
    const bib = referencesBibText(['cb-sem'])
    assertValidBib(bib)
    expect(bib).not.toContain('Yuan')
    expect(bib).not.toContain('Sobel')
  })

  it.each(['cb-sem', 'path-analysis'])(
    'default-run byte-pin (%s): bib with a default-filled (empty-options) setup is byte-identical to no setups arg',
    (id) => {
      // Literal full-string equality (amendment (e)): ANY future conditional-ref leak into a default
      // run fails loudly, not only one that happens to contain one of the four author names.
      const defaultSetup: Record<string, TestSetup> = { [id]: { roles: {}, options: {}, props: {}, blocked: null } }
      expect(referencesBibText([id], defaultSetup)).toBe(referencesBibText([id]))
    },
  )

  it('cb-sem run under MLR + moderation: bib includes Yuan-Bentler (2000) AND Sobel (1982), stays valid', () => {
    const setups: Record<string, TestSetup> = {
      'cb-sem': {
        roles: {}, options: { estimator: 'MLR' }, props: {}, blocked: null,
        moderations: [{ id: 1, moderatorId: 3, pathIndex: 0 }],
      },
    }
    const bib = referencesBibText(['cb-sem'], setups)
    assertValidBib(bib)
    expect(bib).toContain('Yuan')
    expect(bib).toContain('Sobel')
  })

  it('cb-sem run under FIML: bib includes Enders-Bandalos (2001) as a distinct, uniquely-keyed entry', () => {
    const setups: Record<string, TestSetup> = { 'cb-sem': { roles: {}, options: { missing: 'fiml' }, props: {}, blocked: null } }
    const bib = referencesBibText(['cb-sem'], setups)
    assertValidBib(bib)
    expect(bib).toContain('Enders')
    const keys = [...bib.matchAll(/@misc\{([^,]+),/g)].map((m) => m[1])
    expect(new Set(keys).size).toBe(keys.length)
  })
})
