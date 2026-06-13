import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NESTED_ANOVA as spec } from './nestedAnova'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Nested ANOVA</span>'), outputsHtml.indexOf("Welch's ANOVA</span>"))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Nested ANOVA</div>'), inputsHtml.indexOf("<div class=\"ttl\">Welch's ANOVA</div>"))

describe('nested-anova registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('the single table thead equals the card column sequence (decoded)', () => {
    // Use strip() on each <th> to decode entities (e.g. &omega;&sup2; → ω²)
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('the caption is the bare "Table." style — no numbered caption in this card', () => {
    expect([...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
    expect(card).not.toMatch(/<b>Table \d\.<\/b>/)
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(card).not.toContain('tbl-note assume') // plain note, NOT an assumption note
    expect(spec.tableNote!.kind).toBe('plain')
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line equals bundleFiles (verbatim dot-split)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines + hints', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    // Machine arity constraints: both factor roles have {1,1}
    expect(spec.constraints.roles[1]).toMatchObject({ levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } })
    expect(spec.constraints.roles[2]).toMatchObject({ levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } })
  })
  it('options equal the inputs card option strip; nesting is a select pill', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select'])
    expect(spec.options[1]).toMatchObject({ id: 'nesting', choices: ['random', 'fixed'] })
  })
})
