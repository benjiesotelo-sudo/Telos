import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { strip } from './specHtml'

const html = readFileSync('telos_test_outputs.html', 'utf8')
const cb = html.slice(html.indexOf('CB-SEM</span>'), html.indexOf('PLS-SEM</span>'))
const pls = html.slice(html.indexOf('PLS-SEM</span>'), html.indexOf('FAMILY 7'))

const theadAfter = (block: string, cap: string) => {
  const at = block.indexOf(cap)
  const th = block.indexOf('<thead>', at)
  const end = block.indexOf('</thead>', th)
  return [...block.slice(th, end).matchAll(/<th>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
}

describe('SEM-B output cards carry the §6B amendments (B/SE/z/p, ω, reordered PLS reliability)', () => {
  it('CB-SEM Table 3 (CFA loadings) = Construct → Item · B · SE · z · p · Std. loading', () => {
    expect(theadAfter(cb, 'Measurement model (CFA loadings)')).toEqual(
      ['Construct → Item', 'B', 'SE', 'z', 'p', 'Std. loading'],
    )
  })
  it('CB-SEM Table 4 (reliability) adds ω → Construct · CR · AVE · ω · α', () => {
    expect(theadAfter(cb, 'Reliability &amp; validity')).toEqual(
      ['Construct', 'CR', 'AVE', 'ω', 'α'],
    )
  })
  it('CB-SEM Table 6 (structural paths) adds B → Path · B · SE · z · p · Std. β · 95% CI · R²', () => {
    expect(theadAfter(cb, 'Structural paths')).toEqual(
      ['Path', 'B', 'SE', 'z', 'p', 'Std. β', '95% CI', 'R²'],
    )
  })
  it('PLS Table 2 (reliability) final order = Construct · α · ρA · CR (ρC) · AVE', () => {
    expect(theadAfter(pls, 'Reliability &amp; convergent validity')).toEqual(
      ['Construct', 'α', 'ρA', 'CR (ρC)', 'AVE'],
    )
  })
  it('PLS rMap no longer cites plspm (seminr only)', () => {
    const rmap = strip(pls.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])
    expect(rmap).not.toContain('plspm')
    expect(rmap).toContain('seminr')
  })
})
