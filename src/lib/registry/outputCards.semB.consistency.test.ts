import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { strip } from './specHtml'

const html = readFileSync('telos_test_outputs.html', 'utf8')
const cb = html.slice(html.indexOf('CB-SEM</span>'), html.indexOf('PLS-SEM</span>'))
const pls = html.slice(html.indexOf('PLS-SEM</span>'), html.indexOf('FAMILY 7'))

// Flattens a <thead> to its LEAF column labels in visual left-to-right order, regardless of
// rowspan/colspan (U3-T3 spanned dual-CI header) — see cbSem.consistency.test.ts's theadAfter for the
// full rationale: a row-1 <th colspan="n"> is a GROUP label, replaced by the next n leaves from row 2.
const theadAfter = (block: string, cap: string) => {
  const at = block.indexOf(cap)
  const th = block.indexOf('<thead>', at)
  const end = block.indexOf('</thead>', th)
  const theadHtml = block.slice(th, end)
  const trs = [...theadHtml.matchAll(/<tr>(.*?)<\/tr>/gs)].map((m) => m[1])
  if (trs.length < 2) {
    return [...theadHtml.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
  }
  const row2Leaves = [...trs[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
  let row2i = 0
  const leaves: string[] = []
  for (const m of trs[0].matchAll(/<th([^>]*)>(.*?)<\/th>/gs)) {
    const colspan = m[1].match(/colspan="(\d+)"/)
    if (colspan) { for (let i = 0; i < Number(colspan[1]); i++) leaves.push(row2Leaves[row2i++]) }
    else leaves.push(strip(m[2]))
  }
  return leaves
}

describe('SEM-B output cards carry the §6B amendments (B/SE/z/p, ω, reordered PLS reliability)', () => {
  // U3-T1 (2026-07-07): Table 3 (CFA loadings) and Table 4 (reliability) were merged into ONE grouped
  // table — construct rows carry ω/α/CR/AVE once, item rows carry Mean/SD/B/SE/z/p/Std. loading. See
  // cbSem.consistency.test.ts's 'Table 1 (measurement model...)' assertion for the up-to-date check;
  // this test now confirms the merge kept the pre-existing loading/reliability columns, ω included.
  // U3-T4 (2026-07-07): renumbered Table 3 → Table 1 in the final canonical Table 1-5 pass (EFA now
  // captions as preamble Tables E1/E2, ahead of the canonical run).
  it('CB-SEM Table 1 (measurement model, merged) = Construct/Item · Mean · SD · B · SE · z · p · Std. loading · ω · α · CR · AVE', () => {
    expect(theadAfter(cb, 'Measurement model (loadings, reliability &amp; item descriptives)')).toEqual(
      ['Construct / Item', 'Mean', 'SD', 'B', 'SE', 'z', 'p', 'Std. loading', 'ω', 'α', 'CR', 'AVE'],
    )
  })
  // U3-T3 (2026-07-07): Table 6/7 (structural paths / indirect effects) were merged into ONE
  // H-numbered, dual-CI (percentile + BC), Result-ruled table. See cbSem.consistency.test.ts's
  // 'Table 5 (structural paths, indirect effects & moderation)' assertion for the up-to-date check.
  // U3-T4 (2026-07-07): renumbered Table 6 → Table 5 in the final canonical Table 1-5 pass.
  it('CB-SEM Table 5 (merged structural/indirect/moderation) flattens to H · Path · B · Std. β · p · Lower · Upper (perc) · Lower · Upper (BC) · Result', () => {
    expect(theadAfter(cb, 'Structural paths')).toEqual(
      ['H', 'Path', 'B', 'Std. β', 'p', 'Lower', 'Upper', 'Lower', 'Upper', 'Result'],
    )
  })
  // U6-T1 (2026-07-07): PLS Table 1 (outer model) and Table 2 (reliability) were merged into ONE
  // grouped measurement table — construct rows carry CR (ρC)/α/AVE once, indicator rows carry
  // Mean/SD/Loading-or-weight/t/p. See plsSem.consistency.test.ts's 'Table 1 (measurement model,
  // grouped)' assertion for the up-to-date check; this test now confirms the merge kept the
  // construct-level reliability columns (ρA no longer displayed on the merged table).
  it('PLS Table 1 (measurement model, merged) = Construct/item · CR (ρC) · α · AVE · Mean · SD · Loading/weight · t · p', () => {
    expect(theadAfter(pls, 'Measurement model')).toEqual(
      ['Construct / item', 'CR (ρC)', 'α', 'AVE', 'Mean', 'SD', 'Loading / weight', 't', 'p'],
    )
  })
  it('PLS rMap no longer cites plspm (seminr only)', () => {
    const rmap = strip(pls.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])
    expect(rmap).not.toContain('plspm')
    expect(rmap).toContain('seminr')
  })
  it('CB-SEM R map reliability output includes ω (matches Table 1)', () => {
    const cbRmap = cb.match(/<b>R map:<\/b>([\s\S]*?)<\/div>/g)!.join(' ')
    expect(strip(cbRmap)).toContain('ω')
    expect(strip(cbRmap)).toContain('CR/AVE/ω/α')
  })
})
