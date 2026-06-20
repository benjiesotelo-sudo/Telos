import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AVE as spec } from './ave'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('Average variance extracted (AVE)</span>'),
  outputsHtml.indexOf('Composite reliability (CR)</span>'),
)
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(
  inputsHtml.indexOf('<div class="ttl">Average variance extracted (AVE)</div>'),
  inputsHtml.indexOf('<div class="ttl">Composite reliability (CR)</div>'),
)

describe('ave registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('T1 (classic table) thead equals the card column sequence', () => {
    // Only T1 is a classic table with a <thead>; T2/T3 are matrix tables with different structure.
    // Card has 3 <thead> blocks (T1 classic + T2 matrix + T3 matrix); check first one = T1 columns.
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])),
    )
    // T1 columns (first thead), skipping the empty leading <th> of the matrix tables
    const t1Cols = spec.tables[0].columns.map((c) => (c.sub ? `${c.label}${c.sub}` : c.label))
    expect(theads[0]).toEqual(t1Cols)
  })
  it('T1 caption is numbered; T2/T3 matrix captions match spec', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d+\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    // T1 caption
    expect(caps[0]).toBe(spec.tables[0].title)
    // T2 and T3 captions (matrix tables) — decoded HTML entities
    expect(strip(caps[1])).toBe(strip(spec.tables[1].title))
    expect(strip(caps[2])).toBe(strip(spec.tables[2].title))
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
  it('APA line equals the template (no {placeholder} tokens — this card has a fixed APA string)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    // &ldquo; / &rdquo; decode to curly double-quote chars (U+201C / U+201D); strip them before comparing.
    const inner = line.replace(/^[“”]/u, '').replace(/[””]$/u, '')
    expect(inner).toBe(spec.apaTemplate)
  })
  it('R map matches verbatim', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('inputKind is construct-slots (AVE uses construct-slots, not drag-slots)', () => {
    expect(spec.inputKind).toBe('construct-slots')
  })
  it('roles array is empty (constructs replace role slots for AVE)', () => {
    expect(spec.roles).toHaveLength(0)
  })
  it('option pills match the inputs card', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
  })
})
