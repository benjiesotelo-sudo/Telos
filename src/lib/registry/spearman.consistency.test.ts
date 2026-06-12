import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SPEARMAN as spec } from './spearman'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Spearman correlation</span>'), outputsHtml.indexOf("Kendall's tau</span>"))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Spearman correlation</div>'), inputsHtml.indexOf('<div class="ttl">Kendall\'s tau</div>'))

describe('spearman registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label))) // ρ arrives as &rho; — compare decoded
  })
  it('bare table caption equals the card caption', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.file ?? f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; all display-only', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
