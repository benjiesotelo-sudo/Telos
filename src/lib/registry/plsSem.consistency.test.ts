import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLS_SEM as spec } from './plsSem'
import { strip } from './specHtml'

const outputsHtml = readFileSync('docs/specs/telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('PLS-SEM</span>'),
  outputsHtml.indexOf('FAMILY 7'),
)

// Flattens a <thead> to its LEAF column labels in visual left-to-right order, regardless of
// rowspan/colspan (U6-T3 spanned dual-CI header, same convention as cbSem.consistency.test.ts's Table 5):
// with a single header <tr> this is just the <th> texts; with two header <tr>s (a spanned header), each
// row-1 <th colspan="n"> is a GROUP label (not a leaf) and is replaced by the next n leaves pulled from
// row 2, while a row-1 <th rowspan="2"> (or any row-1 <th> without a colspan) IS a leaf and is kept in place.
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

describe('plsSem registry stays faithful to the amended output card (verbatim, card-scoped)', () => {
  it('inputKind is sem-canvas and roles are empty', () => {
    expect(spec.inputKind).toBe('sem-canvas')
    expect(spec.roles).toHaveLength(0)
  })
  it('Table 1 (measurement model, grouped) thead matches the spec columns', () => {
    expect(theadAfter('Measurement model')).toEqual(tableCols('measurement'))
    expect(card).toContain('<div class="apa-cap"><b>Table 1.</b> Measurement model</div>')
  })
  it('Table 3 (structural paths) thead matches the spec columns', () => {
    expect(theadAfter('Structural paths')).toEqual(tableCols('structural'))
  })
  it('Table 4 (structural quality) thead matches the spec columns', () => {
    expect(theadAfter('Structural model quality')).toEqual(tableCols('structural-quality'))
  })
  it('Table 5 (indirect effects) thead matches the spec columns', () => {
    expect(theadAfter('Indirect effects (mediation)')).toEqual(tableCols('indirect-effects'))
  })
  // U6-T5: Table 6, shown only when moderation ran; same conventions as CB-SEM's ghost Table 6.
  it('Table 6 (conditional effects / simple slopes) thead matches the spec columns', () => {
    expect(theadAfter('Conditional effects (simple slopes)')).toEqual(tableCols('conditional-effects'))
    expect(card).toContain('<div class="apa-cap"><b>Table 6.</b> Conditional effects (simple slopes)</div>')
  })
  // R4 (board-clearing slice, owner ruling): the classic two-line Aiken-West interaction chart
  // REPLACES the whiskered simple-slopes figure (file id simple-slopes -> interaction-plot).
  it('a second (optional) figure entry: the two-line interaction plot (replaces the whisker figure, R4)', () => {
    expect(spec.figures).toHaveLength(2)
    expect(spec.figures![1].optional).toBe(true)
    expect(spec.figures![1].file).toBe('interaction-plot')
    expect(spec.figures![1].caption).toBe('Interaction plot (simple slopes)')
    expect(spec.figures![1].type).not.toMatch(/whisker/i)
    expect(spec.bundleFiles).toContain('figure_interaction-plot.png (when moderation present)')
  })
  it('HTMT (Table 2) is a matrix table - present as a caption, no fixed thead', () => {
    expect(card).toContain('Discriminant validity - HTMT')
    expect(spec.tables.find((t) => t.id === 'htmt')!.columns).toHaveLength(0)
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
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“”]/u, '').replace(/[“”]$/u, '')
    expect(inner).toBe(spec.apaTemplate.replace(/\{\w+\}/g, '__'))
  })
  it('R map matches verbatim (seminr only, no plspm)', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap).not.toContain('plspm')
  })
  it('bundle line equals bundleFiles', () => {
    // R4 normalization (justified): the owner-ruled interaction chart renamed the moderation figure
    // (simple-slopes -> interaction-plot), but the spec twin (docs/specs/telos_test_outputs.html) is
    // byte-pinned read-only, so its bundle line still carries the pre-R4 name. Content-preserving
    // one-token map before comparing - same discipline as the H1 byte-pin's documented replaces.
    const bundle = strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1])
      .replace('figure_simple-slopes.png', 'figure_interaction-plot.png')
    expect(bundle.split(' · ')).toEqual(spec.bundleFiles)
  })
  it('HTMT table note cross-references the standalone AVE card (mirrors the CB-SEM Tables 3-4 convention)', () => {
    expect(spec.tableNote!.text).toMatch(/AVE.*card|convergent validity.*own card/i)
    const crossRef = 'Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup.'
    expect(strip(card)).toContain(crossRef)
  })
})
