import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SUMMARY_STATISTICS as spec } from './summaryStatistics'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Summary statistics</span>'), outputsHtml.indexOf('Frequencies &amp; cross-tabs</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Summary statistics</div>'), inputsHtml.indexOf('<div class="ttl">Frequencies &amp; cross-tabs</div>'))

describe('summary-statistics registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('the single table thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('the caption is the bare "Table." style with the card title — no numbered caption in this card', () => {
    expect([...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
    expect(card).not.toMatch(/<b>Table \d\.<\/b>/)
  })
  it('question, plain table note, figure caption/type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(card).not.toContain('tbl-note assume') // a plain note, not an assumption note
    expect(spec.tableNote!.kind).toBe('plain')
    const fig = spec.figures![0]
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(fig.caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${fig.type} per variable (optional)`)
    expect(fig.optional).toBe(true)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line EQUALS bundleFiles; names derive from table id + figure type (+ the card\'s optional tag)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), `figure_${spec.figures![0].type}.png (optional)`]).toEqual(spec.bundleFiles)
  })
  it('the card APA line contains every fixed fragment of the apaTemplate', () => {
    // strip() leaves the card's literal '&nbsp;' entity alone — map it to a space before the containment check.
    const apaLine = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    for (const fragment of spec.apaTemplate.split(/\{[a-z0-9]+\}/)) expect(apaLine).toContain(fragment)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine arity mirrors the drawn text', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles.map((r) => r.arity)).toEqual([{ min: 1, max: Infinity }, { min: 0, max: 1 }]) // 'one or more' · '0 or 1'
    expect(spec.constraints.minRule).toEqual({ kind: 'used-columns', n: 1 })
  })
  it('options equal the inputs card option strip — both display-only pills (the design ruling)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
