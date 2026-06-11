import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FREQUENCIES_CROSSTABS as spec } from './frequenciesCrosstabs'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS test's card (Frequencies → Distribution & normality in both spec files).
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const oStart = outputsHtml.indexOf('Frequencies &amp; cross-tabs</span>')
const card = outputsHtml.slice(oStart, outputsHtml.indexOf('Distribution &amp; normality</span>', oStart))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const iStart = inputsHtml.indexOf('<div class="ttl">Frequencies &amp; cross-tabs</div>')
const inCard = inputsHtml.slice(iStart, inputsHtml.indexOf('<div class="ttl">Distribution &amp; normality</div>', iStart))

describe('frequencies registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — incl. the literal Row \\ Column and the … placeholder column', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label))) // no sub/sup columns on this card
    expect(theads[1][0]).toBe('Row \\ Column') // single backslash at runtime — the card's literal
    expect(theads[1][3]).toBe('…')             // the drawn dynamic-width placeholder
  })
  it('table titles equal the card captions, numbered Table 1./Table 2. (no bare captionStyle)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, PLAIN table note, figure caption, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('plain')        // card class is bare "tbl-note" —
    expect(card).not.toContain('tbl-note assume')     // — not "tbl-note assume"
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it("the card's APA line contains the template's fixed fragments", () => {
    // The card writes "Table&nbsp;X." — &nbsp; is not in decode()'s entity list, so normalize it here.
    const apa = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/)) expect(apa).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, derived from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((f) => `figure_${f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('role slot + constraint line verbatim; arity mirrors "1 to 2"; options both display-only (Benjie ruling)', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([{ roleId: 'variables', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 2 } }])
    expect(spec.constraints.minRule).toEqual({ kind: 'used-columns', n: 1 })
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
