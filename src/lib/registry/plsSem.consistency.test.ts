import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLS_SEM as spec } from './plsSem'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('PLS-SEM</span>'),
  outputsHtml.indexOf('FAMILY 7'),
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

describe('plsSem registry stays faithful to the amended output card (verbatim, card-scoped)', () => {
  it('inputKind is sem-canvas and roles are empty', () => {
    expect(spec.inputKind).toBe('sem-canvas')
    expect(spec.roles).toHaveLength(0)
  })
  it('Table 1 (outer model) thead matches the spec columns', () => {
    expect(theadAfter('outer loadings / weights')).toEqual(tableCols('outer-model'))
  })
  it('Table 2 (reliability) thead matches the spec columns — exact order Construct · α · ρA · CR (ρC) · AVE', () => {
    expect(theadAfter('Reliability &amp; convergent validity')).toEqual(tableCols('reliability'))
    // load-bearing: the display order buildPlsSem must SELECT+REORDER seminr output into
    expect(tableCols('reliability')).toEqual(['Construct', 'α', 'ρA', 'CR (ρC)', 'AVE'])
  })
  it('Table 4 (structural paths) thead matches the spec columns', () => {
    expect(theadAfter('Structural paths')).toEqual(tableCols('structural'))
  })
  it('Table 5 (structural quality) thead matches the spec columns', () => {
    expect(theadAfter('Structural model quality')).toEqual(tableCols('structural-quality'))
  })
  it('Table 6 (indirect effects) thead matches the spec columns', () => {
    expect(theadAfter('Indirect effects (mediation)')).toEqual(tableCols('indirect-effects'))
  })
  it('HTMT (Table 3) is a matrix table — present as a caption, no fixed thead', () => {
    expect(card).toContain('Discriminant validity &mdash; HTMT')
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
  it('APA line equals the template', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“”]/u, '').replace(/[“”]$/u, '')
    expect(inner).toBe(spec.apaTemplate)
  })
  it('R map matches verbatim (seminr only, no plspm)', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap).not.toContain('plspm')
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
})
