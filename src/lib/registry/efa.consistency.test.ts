import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EFA as spec } from './efa'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('Exploratory factor analysis (EFA)</span>'),
  outputsHtml.indexOf('Principal component analysis (PCA)</span>'),
)
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(
  inputsHtml.indexOf('<div class="ttl">Exploratory factor analysis (EFA)</div>'),
  inputsHtml.indexOf('<div class="ttl">Principal component analysis (PCA)</div>'),
)

describe('efa registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('T1/T2/T3 (classic tables) theads equal the card column sequences', () => {
    // T4 is a matrix table (columns: []) — its thead is not checked against spec columns
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])),
    )
    // First 3 theads = T1/T2/T3; T4 matrix thead has an empty leading <th> (skipped)
    const classicTables = spec.tables.filter((t) => t.columns.length > 0)
    expect(theads.slice(0, classicTables.length)).toEqual(
      classicTables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}${c.sub}` : c.label))),
    )
  })
  it('T1/T2/T3 numbered captions and T4 matrix caption match spec', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d+\.<\/b> (.*?)<\/div>/g)].map((m) =>
      strip(m[1]),
    )
    // T1/T2/T3 titles
    expect(strip(caps[0])).toBe(spec.tables[0].title)
    expect(strip(caps[1])).toBe(spec.tables[1].title)
    expect(strip(caps[2])).toBe(spec.tables[2].title)
    // T4 (Φ matrix)
    expect(strip(caps[3])).toBe(strip(spec.tables[3].title))
  })
  it('question matches', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/)![1])).toBe(spec.question)
  })
  it('table note is present', () => {
    expect(card.includes('tbl-note')).toBe(true)
    expect(spec.tableNote).toBeDefined()
  })
  it('figure caption and type match', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
  })
  it('how-to-read matches verbatim', () => {
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
  })
  it('APA template matches (placeholders shown as __)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“”]/u, '').replace(/[“”]$/u, '')
    expect(inner).toBe(spec.apaTemplate.replace(/\{\w+\}/g, '__'))
  })
  it('R map matches verbatim', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('option pills match the inputs card', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
  })
  it('matrix table (T4 Φ) is present in the card HTML', () => {
    expect(card.includes('class="apa matrix"')).toBe(true)
    expect(spec.tables[3].columns).toHaveLength(0)
  })
})
