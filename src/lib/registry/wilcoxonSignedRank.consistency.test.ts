import { describe, it, expect } from 'vitest'
import { WILCOXON_SIGNED_RANK as spec } from './wilcoxonSignedRank'
import { figuresOf } from './types'
import { readSpec, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readSpec('telos_test_outputs.html')
const card = outputsHtml.slice(outputsHtml.indexOf('Wilcoxon signed-rank</span>'), outputsHtml.indexOf('Kruskal-Wallis</span>'))
const inputsHtml = readSpec('telos_test_inputs.html')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Wilcoxon signed-rank</div>'), inputsHtml.indexOf('<div class="ttl">Kruskal-Wallis</div>'))

describe('wilcoxon-signed-rank registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — including the literal "V / W" header', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('table titles equal the card captions, both NUMBERED (no bare captionStyle)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.map((t) => t.captionStyle)).toEqual([undefined, undefined])
  })
  it('question, figure caption, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('the drawn card has NO table note — and neither does the registry entry', () => {
    expect(card).not.toMatch(/class="tbl-note/)
    expect(spec.tableNote).toBeUndefined()
  })
  it('the card APA exemplar contains every fixed fragment of the registry template (Z, p, r only — no V/W, as drawn)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/)) expect(line).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine mirror matches the drawn arity', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([
      { roleId: 'conditionA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ])
    expect(spec.constraints.minRule).toEqual({ kind: 'complete-pairs', n: 3 })
  })
  it('options equal the inputs card option strip; α adjustable, tails select, continuity is toggle', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'toggle'])
    expect(spec.options[2]).toMatchObject({ id: 'continuity', default: true })
  })
})
