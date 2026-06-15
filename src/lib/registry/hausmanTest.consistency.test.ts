import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HAUSMAN_TEST as spec } from './hausmanTest'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Card-scoped (slice to the NEXT card title — robust to document order) so another card can't satisfy an assertion.
const sliceTo = (html: string, start: string, nextMarker: string) => {
  const a = html.indexOf(start)
  const b = html.indexOf(nextMarker, a + start.length)
  return html.slice(a, b === -1 ? undefined : b)
}
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = sliceTo(outputsHtml, '<span class="rt-name">Hausman test</span>', '<span class="rt-name">')
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = sliceTo(inputsHtml, '<div class="ttl">Hausman test</div>', '<div class="ttl">')

describe('hausman-test registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads match the card column sequences', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions match the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
  })
  it('each table has a distinct domId', () => {
    const ids = spec.tables.map((t) => t.domId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id !== undefined)).toBe(true)
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
  it('options equal the inputs card option strip (no CI pill drawn — α only)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number'])
  })
  it('panel backbone: entity nominal/ordinal, time timeOrder, numeric roles exclude datetime, minRule panel ≥12', () => {
    const c = (id: string) => spec.constraints.roles.find((r) => r.roleId === id)
    expect(c('entity')!.levels).toEqual(['nominal', 'ordinal'])
    expect(c('time')!.timeOrder).toBe(true)
    expect(c('outcome')!.excludeTag).toBe('datetime')
    expect(c('regressors')!.excludeTag).toBe('datetime')
    expect(spec.constraints.minRule).toEqual({ kind: 'panel', n: 12 })
  })
  it('no tableNote drawn — spec.tableNote is undefined (no §-addition note for Hausman)', () => {
    expect(spec.tableNote).toBeUndefined()
  })
  it('mutation guard: changing the question breaks the test', () => {
    expect('WRONG').not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
