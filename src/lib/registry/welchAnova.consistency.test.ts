import { describe, it, expect } from 'vitest'
import { readSpec, strip } from './specHtml'
import { WELCH_ANOVA as spec } from './welchAnova'
import { figuresOf } from './types'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readSpec('telos_test_outputs.html')
const card = outputsHtml.slice(outputsHtml.indexOf("Welch's ANOVA</span>"), outputsHtml.indexOf('ANCOVA</span>'))
const inputsHtml = readSpec('telos_test_inputs.html')
const inCard = inputsHtml.slice(inputsHtml.indexOf("<div class=\"ttl\">Welch's ANOVA</div>"), inputsHtml.indexOf('<div class="ttl">ANCOVA</div>'))

describe("welch-anova registry stays faithful to the spec HTML (verbatim, card-scoped)", () => {
  it('table theads equal the card column sequences — including M<sub>diff</sub> and p<sub>adj</sub>', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, PLAIN table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    // note is plain — NOT an assumption note
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(card.includes('tbl-note assume')).toBe(false)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles verbatim', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('role sl-hint lines match the registry hints', () => {
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
  })
  it('options equal the inputs card option strip; both are display kind (Games-Howell locked)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display'])
  })
})
