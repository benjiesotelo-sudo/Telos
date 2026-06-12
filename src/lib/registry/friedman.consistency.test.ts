import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRIEDMAN as spec } from './friedman'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Friedman</span>'), outputsHtml.indexOf('Pearson correlation</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Friedman</div>'), inputsHtml.indexOf('<div class="ttl">Pearson correlation</div>'))

describe('friedman registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (χ² and p_adj as raw HTML)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => decode(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
    // rank-summary has no N column (card-drawn)
    expect(theads[0]).toHaveLength(2)
    // friedman table: χ² · df · p · Kendall's W
    expect(theads[1]).toHaveLength(4)
    // posthoc: Pair · p_adj only
    expect(theads[2]).toHaveLength(2)
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, figure caption + type, how-to-read and R map match verbatim; no table note', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    // Friedman has NO table note
    expect(spec.tableNote).toBeUndefined()
    expect(card.includes('tbl-note')).toBe(false)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line contains every fixed fragment of the template', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    for (const frag of spec.apaTemplate.split(/\{[a-z0-9]+\}/i).filter(Boolean)) expect(line).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles verbatim (figure_profile.png — does not derive from type)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    // Note: figure_profile.png does NOT derive from the type string 'profile / box plot' — asserted verbatim only
  })
  it('roles equal the inputs card slot labels, constraint lines, and sl-hint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
  })
  it('options equal the inputs card option strip — both display pills', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display'])
  })
})
