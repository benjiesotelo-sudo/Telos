// Formerly a byte-compat pin against the pre-kit CITATIONS.txt (single package-references section).
// Direction-B rebuild replaced that shape with a 4-section tiered reference kit — this file now pins
// the NEW format instead: section presence/order, app citation, reference-list dedup, and the
// methods-paragraph fallback. citations.test.ts still covers the (unmoved-in-content, moved-in-
// position) R-package appendix section.
import { describe, it, expect } from 'vitest'
import { citationsText } from './citations'
import { CITE_APP_TEXT } from './citeApp'
import { CATALOG } from '../registry/catalog'
import { CITATIONS } from '../registry/citations'
import type { TestSetup } from '../../state/session'

const nameOf = (id: string) => CATALOG.find((c) => c.id === id)!.name

describe('citationsText — tiered reference kit (direction B)', () => {
  it('has all four sections, in order', () => {
    const t = citationsText(['one-sample-t-test'])
    const i1 = t.indexOf('1. CITE THIS APP')
    const i2 = t.indexOf('2. YOUR REFERENCE LIST')
    const i3 = t.indexOf('3. METHODS PARAGRAPH')
    const i4 = t.indexOf('4. APPENDIX: R PACKAGE CITATIONS')
    expect(i1).toBeGreaterThanOrEqual(0)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
    expect(i4).toBeGreaterThan(i3)
  })

  it('section 1 is the app citation, DOI placeholder included', () => {
    const t = citationsText([])
    expect(t).toContain(CITE_APP_TEXT)
  })

  describe('section 2 — dedup across a 2-test selection sharing Cohen (1988)', () => {
    const selection = ['one-sample-t-test', 'pearson']
    const t = citationsText(selection)
    const cohenText = CITATIONS['one-sample-t-test'].statisticalBasis.find((b) => b.ref.text.startsWith('Cohen, J.'))!.ref.text

    it('Cohen (1988) appears exactly once in the reference list', () => {
      const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
      const occurrences = sec2.split(cohenText).length - 1
      expect(occurrences).toBe(1)
    })

    it('is annotated "[used by: <test A>, <test B>]"', () => {
      const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
      const line = sec2.split('\n').find((l) => l.includes(cohenText))!
      const idx = sec2.indexOf(line)
      const after = sec2.slice(idx, idx + 300)
      expect(after).toContain('[used by:')
      expect(after).toContain(nameOf('one-sample-t-test'))
      expect(after).toContain(nameOf('pearson'))
    })

    it('a ref cited by only one selected test carries no "[used by:" annotation', () => {
      // Student (1908) is only cited by one-sample-t-test in this selection.
      const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
      const studentText = CITATIONS['one-sample-t-test'].statisticalBasis.find((b) => b.ref.text.startsWith('Student'))!.ref.text
      const lineIdx = sec2.indexOf(studentText)
      expect(lineIdx).toBeGreaterThanOrEqual(0)
      expect(sec2.slice(lineIdx, lineIdx + studentText.length + 40)).not.toContain('[used by:')
    })

    it('reference list is alphabetized by leading author surname', () => {
      const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
      // Cohen precedes Pearson precedes Student, alphabetically.
      expect(sec2.indexOf('Cohen')).toBeLessThan(sec2.indexOf('Pearson, K.'))
      expect(sec2.indexOf('Pearson, K.')).toBeLessThan(sec2.indexOf('Student'))
    })
  })

  describe('section 3 — methods paragraph', () => {
    it('has a generic (no live-numbers) sentence per selected test when no live values are supplied', () => {
      const t = citationsText(['one-sample-t-test'])
      const sec3 = t.slice(t.indexOf('3. METHODS PARAGRAPH'), t.indexOf('4. APPENDIX'))
      expect(sec3).toContain(nameOf('one-sample-t-test'))
      expect(sec3).toContain(CITATIONS['one-sample-t-test'].whyThisTest.text)
    })

    it('uses the live apaTemplate-filled sentence for a test when one is supplied', () => {
      const live = 'A one-sample t-test showed t(29)=2.50, p=.018.'
      const t = citationsText(['one-sample-t-test'], { 'one-sample-t-test': live })
      const sec3 = t.slice(t.indexOf('3. METHODS PARAGRAPH'), t.indexOf('4. APPENDIX'))
      expect(sec3).toContain(live)
    })
  })

  it('section 4 keeps the existing package-citation content, now as the final section', () => {
    const t = citationsText(['independent-t-test'])
    expect(t.indexOf('4. APPENDIX: R PACKAGE CITATIONS')).toBeGreaterThan(t.indexOf('3. METHODS PARAGRAPH'))
    expect(t).toContain('R 4.6.0')
    expect(t.lastIndexOf('R 4.6.0')).toBeGreaterThan(t.indexOf('4. APPENDIX: R PACKAGE CITATIONS'))
  })
})

// Task 8: a default (untouched dropdowns) run's citation output is byte-unchanged - both when no
// `setups` arg is passed at all (pre-Task-8 call shape, still legal) and when one is passed with
// empty options (a fresh setup).
describe('citationsText - default-run byte-pin (Task 8)', () => {
  it('cb-sem with NO setups arg is byte-identical to cb-sem with an empty-options setup', () => {
    const withoutSetups = citationsText(['cb-sem'], {})
    const withDefaultSetup = citationsText(['cb-sem'], {}, { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null } })
    expect(withDefaultSetup).toBe(withoutSetups)
  })

  it('cb-sem default run never mentions the conditional refs (Yuan/Muthen/Enders/Sobel)', () => {
    const t = citationsText(['cb-sem'])
    const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
    expect(sec2).not.toContain('Yuan')
    expect(sec2).not.toContain('Muth')
    expect(sec2).not.toContain('Enders')
    expect(sec2).not.toContain('Sobel')
  })
})

describe('citationsText - conditional method refs earn their way into the reference list (Task 8)', () => {
  it('cb-sem run under MLR: reference list includes Yuan-Bentler (2000)', () => {
    const setups: Record<string, TestSetup> = { 'cb-sem': { roles: {}, options: { estimator: 'MLR' }, props: {}, blocked: null } }
    const t = citationsText(['cb-sem'], {}, setups)
    const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
    expect(sec2).toContain('Yuan')
    expect(t).toContain(nameOf('cb-sem')) // section 3's methods paragraph always names the test
  })

  it('path-analysis run under WLSMV + an indirect chain: reference list includes the WLSMV source AND Sobel (1982)', () => {
    const setups: Record<string, TestSetup> = {
      'path-analysis': {
        roles: {}, options: { estimator: 'WLSMV' }, props: {}, blocked: null,
        paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
      },
    }
    const t = citationsText(['path-analysis'], {}, setups)
    const sec2 = t.slice(t.indexOf('2. YOUR REFERENCE LIST'), t.indexOf('3. METHODS PARAGRAPH'))
    expect(sec2).toContain('Muth')
    expect(sec2).toContain('Sobel')
    expect(sec2).not.toContain('Yuan')
  })

  it('the registry\'s own base cb-sem refs (e.g. Rosseel/lavaan) still appear alongside a conditional ref', () => {
    const cohenRef = CITATIONS['cb-sem'].statisticalBasis.find((b) => b.ref.text.startsWith('Rosseel'))!.ref.text
    const setups: Record<string, TestSetup> = { 'cb-sem': { roles: {}, options: { estimator: 'MLR' }, props: {}, blocked: null } }
    const t = citationsText(['cb-sem'], {}, setups)
    expect(t).toContain(cohenRef)
  })
})
