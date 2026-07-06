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
  // U3-T1 (2026-07-07): Table 3 (CFA loadings) and Table 4 (reliability) were merged into ONE grouped
  // table — construct rows carry ω/α/CR/AVE once, item rows carry Mean/SD/B/SE/z/p/Std. loading. See
  // cbSem.consistency.test.ts's 'Table 3 (measurement model...)' assertion for the up-to-date check;
  // this test now confirms the merge kept the pre-existing loading/reliability columns, ω included.
  it('CB-SEM Table 3 (measurement model, merged) = Construct/Item · Mean · SD · B · SE · z · p · Std. loading · ω · α · CR · AVE', () => {
    expect(theadAfter(cb, 'Measurement model (loadings, reliability &amp; item descriptives)')).toEqual(
      ['Construct / Item', 'Mean', 'SD', 'B', 'SE', 'z', 'p', 'Std. loading', 'ω', 'α', 'CR', 'AVE'],
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
  it('CB-SEM R map reliability output includes ω (matches Table 4)', () => {
    const cbRmap = cb.match(/<b>R map:<\/b>([\s\S]*?)<\/div>/g)!.join(' ')
    expect(strip(cbRmap)).toContain('ω')
    expect(strip(cbRmap)).toContain('CR/AVE/ω/α')
  })
})
