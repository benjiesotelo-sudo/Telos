import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MANOVA as spec } from './manova'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card: 'MANOVA</span>' first occurrence is the MANOVA card (precedes MANCOVA).
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('MANOVA</span>'), outputsHtml.indexOf('MANCOVA</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">MANOVA</div>'), inputsHtml.indexOf('<div class="ttl">MANCOVA</div>'))

describe('manova registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decode HTML entities in th)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => decode(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles (no derivation — figure_means.png does not derive from type)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
  it('the drawn card carries the assume-note (Box\'s M) — registry static text mirrored verbatim', () => {
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('assume')
    expect(card.includes('tbl-note assume')).toBe(true)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('sl-hint lines equal spec.roles[].hint', () => {
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
  })
  it('options equal the inputs card option strip; statistic is select; followups is toggle', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'toggle'])
    expect(spec.options[1]).toMatchObject({ id: 'statistic', choices: ['Pillai', 'Wilks'] })
    expect(spec.options[2]).toMatchObject({ id: 'followups', default: true })
  })
})
