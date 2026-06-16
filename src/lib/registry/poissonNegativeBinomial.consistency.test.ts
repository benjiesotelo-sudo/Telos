import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { POISSON_NEGATIVE_BINOMIAL as spec } from './poissonNegativeBinomial'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Card-scoped (slice to the NEXT card title — robust to document order) so another card can't satisfy an assertion.
const sliceTo = (html: string, start: string, nextMarker: string) => {
  const a = html.indexOf(start)
  const b = html.indexOf(nextMarker, a + start.length)
  return html.slice(a, b === -1 ? undefined : b)
}
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = sliceTo(outputsHtml, '<span class="rt-name">Poisson / negative binomial</span>', '<span class="rt-name">')
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = sliceTo(inputsHtml, '<div class="ttl">Poisson / negative binomial</div>', '<div class="ttl">')

describe('poisson-negative-binomial registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (single coef table: B | IRR)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('the GOF footer stub labels in the card equal spec.tables[0].gof labels in order', () => {
    const stubs = [...card.matchAll(/<tr class="row-gof"><td>(.*?)<\/td>/g)].map((m) => strip(m[1]))
    expect(stubs).toEqual(spec.tables[0].gof!.map((g) => g.label))
  })
  it('numbered table caption equals the card caption', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('coef table is kind:coef with two model columns (B | IRR) and a distinct domId', () => {
    expect(spec.tables.length).toBe(1)
    expect(spec.tables[0].kind).toBe('coef')
    expect(spec.tables[0].models).toEqual([{ key: 'b', label: 'Log-count (B)' }, { key: 'irr', label: 'IRR' }])
    expect(spec.tables[0].domId).toBe('poisson-nb-coefficients')
  })
  it('question, assume table note (the drawn dispersion note, card-literal), figure, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __ (Predictor X stays literal on the card)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const lq = decode('&ldquo;'); const rq = decode('&rdquo;')
    expect(line).toBe(`${lq}${spec.apaTemplate.replace(/\{\w+\}/g, '__')}${rq}`)
  })
  it('bundle line EQUALS bundleFiles, names derive from the table id + figure file slug (Model fit merged into the footer)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines (count outcome, optional offset exposure)', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label)) // 'Exposure (optional)' — styled span strips to this
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles[0].tag).toBe('count')                       // B1 — recorded decision 6
    expect(spec.constraints.roles[2].arity).toEqual({ min: 0, max: 1 })       // optional slot never blocks
  })
  it('options equal the inputs card option strip; model is the select with the two drawn choices', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['select', 'number', 'select', 'display'])
    expect(spec.options[0]).toMatchObject({ id: 'model', choices: ['Poisson', 'negative binomial'] })
  })
  it('the model hint is the drawn config-guide sentence (cfgguide wording)', () => {
    const guide = strip(inCard.match(/<div class="cfgguide">(.*?)<\/p>/s)![1])
    expect(guide).toContain(spec.options[0].hint!)
  })
})
