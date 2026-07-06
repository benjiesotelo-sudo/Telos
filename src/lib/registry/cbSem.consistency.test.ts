import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CB_SEM as spec } from './cbSem'
import { strip } from './specHtml'
import { buildCbSem } from '../results/buildCbSem'
import type { CbSemResult } from '../stats/runCbSem'

// U3-T5: CB-SEM's single giant tableNote is superseded by labelled notes (content.notes) for the live
// card; CB_SEM.tableNote itself survives only as an unread legacy fallback field. A minimal, non-
// saturated, no-dynamic-triggers CbSemResult fixture (no cfaLoadings/rsquare/moderation, bootstrapped
// with nboot>=7000) yields exactly the STATIC labelled notes, so the content-preservation checks below
// compare against the concatenation of those notes' text rather than spec.tableNote!.text.
const staticNotesFixture: CbSemResult = {
  mode: 'full', saturated: false, cfaLoadings: [], reliability: [], itemStats: [],
  fit: { chisq: 1, df: 1, pvalue: 1, cfi: 1, tli: 1, rmsea: 0, rmseaLower: 0, rmseaUpper: 0, srmr: 0 },
  structural: [{ from: 1, to: 2, b: 1, se: 1, z: 1, p: 1, stdBeta: 1, ciLower: 1, ciUpper: 1, ciPercLower: 1, ciPercUpper: 1, ciBcLower: 1, ciBcUpper: 1 }],
  bootstrapped: true, nboot: 10000,
  fornellLarcker: [], htmt: [], corLvP: [], discriminantLabels: [],
  estimates: { paths: [], loadings: {}, r2: {} },
} as unknown as CbSemResult
const staticNotesText = () => buildCbSem(spec, staticNotesFixture).notes!.map((n) => n.text).join(' ')

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('CB-SEM</span>'),
  outputsHtml.indexOf('PLS-SEM</span>'),
)

// Flattens a <thead> to its LEAF column labels in visual left-to-right order, regardless of
// rowspan/colspan (U3-T3 spanned dual-CI header): with a single header <tr> this is just the <th>
// texts; with two header <tr>s (a spanned header), each row-1 <th colspan="n"> is a GROUP label (not a
// leaf) and is replaced by the next n leaves pulled from row 2, while a row-1 <th rowspan="2"> (or any
// row-1 <th> without a colspan) IS a leaf and is kept in place — reconstructing the same left-to-right
// order the ApaTable renderer (and a reader's eye) would see.
const theadAfter = (cap: string) => {
  const at = card.indexOf(cap)
  const th = card.indexOf('<thead>', at)
  const end = card.indexOf('</thead>', th)
  const theadHtml = card.slice(th, end)
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
const tableCols = (id: string) => {
  const t = spec.tables.find((x) => x.id === id)!
  return t.columns.map((c) => `${c.label}${c.sub ?? ''}${c.suffix ?? ''}`)
}

describe('cbSem registry stays faithful to the amended output card (verbatim, card-scoped)', () => {
  it('inputKind is sem-canvas (CB-SEM uses the AMOS canvas, not construct-slots or drag-slots); roles empty', () => {
    expect(spec.inputKind).toBe('sem-canvas')
    expect(spec.roles).toHaveLength(0)
  })
  // U3-T4: EFA is a PREAMBLE stage — captions "Table E1./Table E2." (never counted into the card's
  // canonical Table 1-5 run), so both a captionStyle/preambleLabel check and a literal-caption check earn
  // their keep here (theadAfter alone, by title text, wouldn't catch a caption-numbering regression).
  it('Tables E1/E2 (EFA suitability + rotated loadings) are preamble tables (not counted in canonical numbering)', () => {
    expect(spec.tables.find((t) => t.id === 'efa-suitability')).toMatchObject({ captionStyle: 'preamble', preambleLabel: 'E1' })
    expect(spec.tables.find((t) => t.id === 'efa-loadings')).toMatchObject({ captionStyle: 'preamble', preambleLabel: 'E2' })
    expect(theadAfter('EFA suitability')).toEqual(tableCols('efa-suitability'))
    expect(theadAfter('EFA rotated factor loadings')).toEqual(tableCols('efa-loadings'))
    expect(card).toContain('<div class="apa-cap"><b>Table E1.</b> EFA suitability</div>')
    expect(card).toContain('<div class="apa-cap"><b>Table E2.</b> EFA rotated factor loadings</div>')
  })
  it('Table 1 (measurement model: loadings, reliability & item descriptives) thead matches the spec columns', () => {
    expect(theadAfter('Measurement model (loadings, reliability &amp; item descriptives)')).toEqual(tableCols('cfa-loadings'))
    expect(card).toContain('<div class="apa-cap"><b>Table 1.</b> Measurement model (loadings, reliability &amp; item descriptives)</div>')
  })
  it('Table 2 (fit indices) thead matches the spec columns', () => {
    expect(theadAfter('Fit indices')).toEqual(tableCols('fit-indices'))
    expect(card).toContain('<div class="apa-cap"><b>Table 2.</b> Fit indices</div>')
  })
  it('Table 3/4 (Fornell-Larcker/HTMT) captions and note text match', () => {
    const flTitle = spec.tables.find((t) => t.id === 'fornell-larcker')!.title
    const htmtTitle = spec.tables.find((t) => t.id === 'htmt')!.title
    const flCap = strip(card.match(/<div class="apa-cap"><b>Table 3\.<\/b>(.*?)<\/div>/s)![1])
    const htmtCap = strip(card.match(/<div class="apa-cap"><b>Table 4\.<\/b>(.*?)<\/div>/s)![1])
    expect(flCap).toBe(flTitle)
    expect(htmtCap).toBe(htmtTitle)
    const crossRef =
      'Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup.'
    // U3-T5: this sentence now lives in the labelled notes (label 'Discriminant validity'), not the
    // legacy spec.tableNote -- content-preservation guard, not byte-verbatim (see file header).
    expect(staticNotesText()).toContain(crossRef)
    expect(strip(card)).toContain(crossRef)
  })
  // U3-T3: structural paths + indirect effects + moderation merged into ONE H-numbered, dual-CI,
  // Result-ruled table with a two-row spanning header (Percentile 95% CI / BC 95% CI). theadAfter
  // flattens <th> text regardless of rowspan/colspan, so this compares the FLATTENED leaf column list.
  it('Table 5 (structural paths, indirect effects & moderation) thead flattens to the spec columns', () => {
    expect(theadAfter('Structural paths, indirect effects &amp; moderation')).toEqual(tableCols('structural-paths'))
    expect(card).toContain('<div class="apa-cap"><b>Table 5.</b> Structural paths, indirect effects &amp; moderation</div>')
  })
  it('canonical Table 1-5 order matches the reordered registry (measurement, fit, Fornell-Larcker, HTMT, structural)', () => {
    expect(spec.tables.map((t) => t.id)).toEqual([
      'efa-suitability', 'efa-loadings', 'cfa-loadings', 'fit-indices', 'fornell-larcker', 'htmt', 'structural-paths',
    ])
  })
  it('labelled notes (the live card) reflect the E1/E2 preamble + single merged Table 5 (structural) omission wording', () => {
    // U3-T5: superseded from a byte-verbatim spec.tableNote!.text check to a content-preservation guard
    // against the built labelled notes (the "Scope" label carries this content now; wording may legally
    // differ in small ways -- e.g. "the E1/E2 preamble" vs "Tables E1-E2" -- by design, not byte-verbatim).
    const text = staticNotesText()
    expect(text).toContain('if EFA was deselected')
    expect(text).toContain('the structural stage was deselected, Table 5 is omitted')
  })
  it('question matches', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/)![1])).toBe(spec.question)
  })
  it('figure caption and type match', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
  })
  it('how-to-read matches verbatim', () => {
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
  })
  it('APA line equals the template', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“”]/u, '').replace(/[“”]$/u, '')
    expect(inner).toBe(spec.apaTemplate)
  })
  it('R map matches verbatim', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
})
