import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { citationsText } from './citations'

describe('CITATIONS.txt byte-compat (A4 - existing package section unchanged)', () => {
  it('the package-citations section is byte-identical to the pre-registry output', () => {
    // Captured via a direct citationsText() call against pre-task main, NOT copied from
    // docs/test-documentation/05_independent-t-test/export/CITATIONS.txt - that doc predates the
    // SEM-B slice's lavaan/semTools/seminr/semPlot emitters and is stale relative to the live
    // package union (confirmed by diffing it against a live citationsText() run). The fixture
    // below is today's actual shipping output, before this task's change, through its final line.
    const BEFORE = readFileSync(new URL('./__fixtures__/citations-before.txt', import.meta.url), 'utf8')
    const after = citationsText(['independent-t-test'])
    expect(after.startsWith(BEFORE.trimEnd())).toBe(true)
  })
})
