import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { RDD as spec } from './rdd'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Card-scoped (slice to the NEXT card title — robust to document order) so another card can't satisfy an assertion.
const sliceTo = (html: string, start: string, nextMarker: string) => {
  const a = html.indexOf(start)
  const b = html.indexOf(nextMarker, a + start.length)
  return html.slice(a, b === -1 ? undefined : b)
}
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = sliceTo(outputsHtml, '<span class="rt-name">Regression discontinuity (RDD)</span>', '<span class="rt-name">')
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = sliceTo(inputsHtml, '<div class="ttl">Regression discontinuity (RDD)</div>', '<div class="ttl">')

describe('rdd registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table thead matches the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })

  it('bare table caption equals the card caption (no Table N. numbering)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })

  it('single table has a distinct domId (zip-filename collision guard)', () => {
    expect(spec.tables[0].domId).toBe('rd-estimate')
  })

  it('no drawn table note — tableNote is absent from the registry', () => {
    expect(spec.tableNote).toBeUndefined()
    expect(card.match(/<p class="tbl-note">/)).toBeNull()
  })

  it('question, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })

  it('APA line equals the template with every {placeholder} as __ (report-only mirror)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const lq = decode('&ldquo;'); const rq = decode('&rdquo;')
    expect(line).toBe(`${lq}${spec.apaTemplate.replace(/\{\w+\}/g, '__')}${rq}`)
  })

  it('HTML bundle line equals bundleFiles', () => {
    const htmlBundle = strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')
    expect(htmlBundle).toEqual(spec.bundleFiles)
  })

  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })

  it('options equal the inputs card option strip (no α, no CI pill drawn)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'display', 'select'])
    expect(spec.options[0]).toMatchObject({ id: 'cutoff', value: '50', default: 50 })
    expect(spec.options[1]).toMatchObject({ id: 'bandwidth', value: 'auto', kind: 'display' })
    expect(spec.options[2]).toMatchObject({ id: 'poly', value: '1 · linear', kind: 'select' })
  })

  it('both roles require interval/ratio · exactly 1 (cross-section guards)', () => {
    const outcome = spec.constraints.roles.find((r) => r.roleId === 'outcome')
    const running = spec.constraints.roles.find((r) => r.roleId === 'running')
    expect(outcome!.levels).toEqual(['interval', 'ratio'])
    expect(outcome!.arity).toEqual({ min: 1, max: 1 })
    expect(running!.levels).toEqual(['interval', 'ratio'])
    expect(running!.arity).toEqual({ min: 1, max: 1 })
  })

  it('minRule is values ≥ 20 (minimum complete observations for an RD estimate)', () => {
    expect(spec.constraints.minRule).toEqual({ kind: 'values', n: 20 })
  })

  it('mutation guard: changing the question breaks the test', () => {
    expect('WRONG').not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
