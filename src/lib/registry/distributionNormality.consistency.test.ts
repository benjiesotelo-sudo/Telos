import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DISTRIBUTION_NORMALITY as spec } from './distributionNormality'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Distribution &amp; normality</span>'), outputsHtml.indexOf('One-sample t-test</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Distribution &amp; normality</div>'), inputsHtml.indexOf('<div class="ttl">Independent t-test</div>'))

describe('distribution-normality registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('the single thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('the card prints a bare "Table." caption and the title matches', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })
  it('ghost rows pin the builder strings — variable example first, then the test label with its en-dash', () => {
    const ghost = card.match(/<tbody class="ghost">(.*?)<\/tbody>/s)![1]
    expect([...ghost.matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td>/g)].map((m) => [decode(m[1]), decode(m[2])]))
      .toEqual([['post_score', 'Shapiro-Wilk'], ['post_score', 'K–S (Lilliefors)']])
  })
  it('question, plain table note, how-to-read and R map match verbatim; no assume note', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('plain')
    expect(spec.assumptionNote).toBeUndefined()
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('one drawn figbox ("histogram + Q–Q plot per variable") ↔ two FigureSpecs sharing the caption, neither optional', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe('Distribution shape')
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe('type: histogram + Q–Q plot per variable')
    expect(figuresOf(spec)).toEqual([{ caption: 'Distribution shape', type: 'histogram' }, { caption: 'Distribution shape', type: 'qq' }])
  })
  it('the APA template re-yields the card exemplar when placeholders become __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace('{w}', '__').replace('{p}', '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure types', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('role equals the inputs card slot label + constraint line; machine constraints mirror it', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints).toEqual({ roles: [{ roleId: 'variable', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } }], minRule: { kind: 'values', n: 3 } })
  })
  it('options equal the inputs card option strip — both display-only pills', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
