import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STATIONARITY_TESTS as spec } from './stationarityTests'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('Stationarity tests (ADF, KPSS)</span>'),
  outputsHtml.indexOf('Granger causality</span>'),
)
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(
  inputsHtml.indexOf('<div class="ttl">Stationarity tests (ADF, KPSS)</div>'),
  inputsHtml.indexOf('<div class="ttl">Granger causality</div>'),
)

describe('stationarity-tests registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table thead equals the card column sequence (decode τ entity)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })

  it('bare table caption equals the card caption', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })

  it('single table has a distinct domId (zip-filename collision guard)', () => {
    expect(spec.tables[0].domId).toBe('stationarity-tests-stationarity')
  })

  it('plain table note equals the drawn card note (decode τ, —, –, ", " entities)', () => {
    const note = card.match(/<p class="tbl-note">(.*?)<\/p>/s)
    expect(note).not.toBeNull()
    expect(spec.tableNote).toMatchObject({ kind: 'plain' })
    expect(spec.tableNote!.text).toBe(strip(note![1]))
  })

  it('question, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    // Single figbox in the drawn card — matches figures[0]
    const figCap = card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)
    const figType = card.match(/<div class="ftype">(.*?)<\/div>/s)
    expect(strip(figCap![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(figType![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })

  it('figures[0] and figures[1] share the same caption + type (two files from one figbox)', () => {
    const figs = figuresOf(spec)
    expect(figs).toHaveLength(2)
    expect(figs[0].caption).toBe(figs[1].caption)
    expect(figs[0].type).toBe(figs[1].type)
    expect(figs[0].file).toBe('series')
    expect(figs[1].file).toBe('acf')
  })

  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })

  it('bundle line EQUALS bundleFiles; derive from table id + figure file slugs', () => {
    const htmlBundle = strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')
    expect(htmlBundle).toEqual(spec.bundleFiles)
    expect([
      ...spec.tables.map((t) => `table_${t.id}.png`),
      ...figuresOf(spec).map((f) => `figure_${f.file ?? f.type}.png`),
    ]).toEqual(spec.bundleFiles)
  })

  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })

  it('options equal the inputs card option strip; test is select, lags is select, α is number', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['select', 'select', 'number'])
    expect(spec.options[0]).toMatchObject({ id: 'test', value: 'both · ADF + KPSS', default: true })
    expect(spec.options[1]).toMatchObject({ id: 'lags', value: 'auto' })
    expect(spec.options[2]).toMatchObject({ id: 'alpha', value: '0.05', default: 0.05 })
  })

  it('time role uses timeOrder:true; series role uses excludeTag:datetime (spec §1.1 guards)', () => {
    const timeConstraint = spec.constraints.roles.find((r) => r.roleId === 'time')
    const seriesConstraint = spec.constraints.roles.find((r) => r.roleId === 'series')
    expect(timeConstraint?.timeOrder).toBe(true)
    expect(timeConstraint?.levels).toEqual([])
    expect(seriesConstraint?.excludeTag).toBe('datetime')
    expect(seriesConstraint?.levels).toEqual(['interval', 'ratio'])
  })

  it('minRule is values ≥ 20 (spec §1.5 — minimum 20 complete observations)', () => {
    expect(spec.constraints.minRule).toEqual({ kind: 'values', n: 20 })
  })

  it('mutation guard: changing question breaks the test (discriminates)', () => {
    const mutated = { ...spec, question: 'WRONG QUESTION' }
    expect(mutated.question).not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
