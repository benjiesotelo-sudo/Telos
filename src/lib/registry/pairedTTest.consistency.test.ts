import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PAIRED_T_TEST as spec } from './pairedTTest'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS test's card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Paired t-test</span>'), outputsHtml.indexOf('One-way ANOVA + post-hoc</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Paired t-test</div>'), inputsHtml.indexOf('<div class="ttl">Factorial ANOVA</div>'))

describe('paired-t-test registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — incl. M<sub>diff</sub> and d<sub>z</sub>; Table 1 has no SE column', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
    expect(theads[0]).toHaveLength(4) // Condition · N · M · SD — the card draws no SE
  })
  it('table titles equal the numbered card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true) // numbered "Table N.", not bare
  })
  it('question, note, figure caption + drawn type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('assume')
    expect([...card.matchAll(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/gs)].map((m) => strip(m[1]))).toEqual(figuresOf(spec).map((fg) => fg.caption))
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe('type: paired-lines / difference plot')
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA exemplar contains every fixed fragment of the template', () => {
    const apa = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/).filter(Boolean)) expect(apa).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure types', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((fg) => `figure_${fg.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine constraints mirror "exactly 1"', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles.map((r) => r.arity)).toEqual([{ min: 1, max: 1 }, { min: 1, max: 1 }])
    expect(spec.constraints.minRule).toEqual({ kind: 'complete-pairs', n: 3 })
  })
  it('options equal the inputs card option strip; α adjustable, tails select, CI adjustable', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'select'])
  })
})
