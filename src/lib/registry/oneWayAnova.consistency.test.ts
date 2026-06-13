import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ONE_WAY_ANOVA as spec } from './oneWayAnova'
import { decode, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('One-way ANOVA + post-hoc</span>'), outputsHtml.indexOf('Factorial ANOVA</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// NOTE: inputs card order differs from outputs — next card after One-way ANOVA in inputs is One-sample t-test
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">One-way ANOVA + post-hoc</div>'), inputsHtml.indexOf('<div class="ttl">One-sample t-test</div>'))

describe('one-way-anova registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => decode(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, assume table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(card.includes('tbl-note assume')).toBe(true) // assume note, NOT a plain note
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles verbatim (figure filename does not derive from type string)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('role sl-hint lines match spec.roles[*].hint', () => {
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
  })
  it('options pills (label+value) equal; kinds are number/select/select; α adjustable, CI adjustable', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'select'])
    expect(spec.options[1]).toMatchObject({ id: 'posthoc', choices: ['Tukey HSD', 'Bonferroni', 'Scheffé'] })
    // The hint note under the options strip (class="s" div inside the options inner)
    const hintDiv = inCard.match(/<div class="s"[^>]*>(.*?)<\/div>/s)
    expect(hintDiv).not.toBeNull()
    expect(strip(hintDiv![1])).toBe(spec.options[1].hint)
  })
})
