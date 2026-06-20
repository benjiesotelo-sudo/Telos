import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CB_SEM as spec } from './cbSem'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('CB-SEM</span>'),
  outputsHtml.indexOf('PLS-SEM</span>'),
)

const theadAfter = (cap: string) => {
  const at = card.indexOf(cap)
  const th = card.indexOf('<thead>', at)
  const end = card.indexOf('</thead>', th)
  return [...card.slice(th, end).matchAll(/<th>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
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
  it('Table 1/2 (EFA suitability + rotated loadings) theads match the spec columns', () => {
    expect(theadAfter('EFA suitability')).toEqual(tableCols('efa-suitability'))
    expect(theadAfter('EFA rotated factor loadings')).toEqual(tableCols('efa-loadings'))
  })
  it('Table 3 (CFA loadings) thead matches the spec columns', () => {
    expect(theadAfter('Measurement model (CFA loadings)')).toEqual(tableCols('cfa-loadings'))
  })
  it('Table 4 (reliability) thead matches the spec columns', () => {
    expect(theadAfter('Reliability &amp; validity')).toEqual(tableCols('reliability'))
  })
  it('Table 5 (fit indices) thead matches the spec columns', () => {
    expect(theadAfter('Fit indices')).toEqual(tableCols('fit-indices'))
  })
  it('Table 6 (structural paths) thead matches the spec columns', () => {
    expect(theadAfter('Structural paths')).toEqual(tableCols('structural-paths'))
  })
  it('Table 7 (indirect effects) thead matches the spec columns', () => {
    expect(theadAfter('Indirect effects (mediation)')).toEqual(tableCols('indirect-effects'))
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
