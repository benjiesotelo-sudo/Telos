import { describe, it, expect } from 'vitest'
import { referencesBibText } from './referencesBib'

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
})
