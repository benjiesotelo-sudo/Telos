import { describe, it, expect } from 'vitest'
import { ONE_SAMPLE_T_TEST as spec } from './oneSampleTTest'
import { figuresOf } from './types'
import { readSpec, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readSpec('telos_test_outputs.html')
const card = outputsHtml.slice(outputsHtml.indexOf('One-sample t-test</span>'), outputsHtml.indexOf('Independent t-test</span>'))
const inputsHtml = readSpec('telos_test_inputs.html')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">One-sample t-test</div>'), inputsHtml.indexOf('<div class="ttl">Paired t-test</div>'))

describe('one-sample t-test registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — including the M<sub>diff</sub> markup', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('table titles equal the card captions, and both captions are NUMBERED (no bare style)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, assume note, figure caption + type line, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('assume')
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toContain(figuresOf(spec)[0].type) // 'type: distribution / boxplot with a reference line at the test value'
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it("the card's exemplar APA line equals the template with placeholders as blanks", () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__').replace(/=/g, ' = ')}”`)
  })
  it('roles equal the inputs card slot labels + constraint lines; arity mirrors "exactly 1"', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([{ roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }])
  })
  it('options equal the inputs card option strip; μ₀ is the only interactive (number, default 0)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'display', 'display', 'display'])
    expect(spec.options[0]).toMatchObject({ id: 'mu0', default: 0 })
  })
})
