import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHI_SQUARE_GOF as spec } from './chiSquareGof'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Chi-square goodness-of-fit</span>'), outputsHtml.indexOf("Fisher's exact</span>"))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Chi-square goodness-of-fit</div>'), inputsHtml.indexOf('<div class="ttl">Fisher\'s exact</div>'))

describe('chi-square-goodness-of-fit registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — χ², k−1)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with {df} as the drawn k−1 and every other {placeholder} as __ (recorded decision 2)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace('{df}', 'k−1').replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.file ?? f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; expected proportions is the proportions kind (R1)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['proportions', 'display'])
  })
})
