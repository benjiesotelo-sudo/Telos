import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ARIMA_SARIMA as spec } from './arimaSarima'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('ARIMA / SARIMA</span>'),
  outputsHtml.indexOf('Stationarity tests (ADF, KPSS)</span>'),
)
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// In inputs HTML, ARIMA / SARIMA is followed by Fixed effects (not Stationarity)
const inCard = inputsHtml.slice(
  inputsHtml.indexOf('<div class="ttl">ARIMA / SARIMA</div>'),
  inputsHtml.indexOf('<div class="ttl">Fixed effects</div>'),
)

describe('arima-sarima registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  // modelsummary coef table (design 2026-06-16): Table 1 = stacked coef table (thead = ['', '(1)']
  // + GOF footer merging the old diagnostics), Table 2 = the classic Forecast table.
  it('table theads equal the card column sequences (coef thead [\'\', (1)] then Forecast columns)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => decode(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })

  it('numbered table captions equal the card captions (decode &amp; entity)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => decode(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })

  it('the GOF footer stub labels merge diagnostics into Table 1 (Num.Obs., σ², Ljung–Box p, AIC, BIC, Log.Lik.)', () => {
    const stubs = [...card.matchAll(/<tr class="row-gof"><td>(.*?)<\/td>/g)].map((m) => decode(m[1]))
    expect(stubs).toEqual(spec.tables[0].gof!.map((g) => g.label))
  })

  it('each table has a distinct domId (no zip-filename collision)', () => {
    const ids = spec.tables.map((t) => t.domId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id !== undefined)).toBe(true)
  })

  it('plain table note after model-summary equals the drawn card note', () => {
    const note = card.match(/<p class="tbl-note">(.*?)<\/p>/s)
    expect(note).not.toBeNull()
    expect(spec.tableNote).toMatchObject({ kind: 'plain', afterTableId: 'model-summary' })
    expect(spec.tableNote!.text).toBe(strip(note![1]))
  })

  it('question, first figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    // The drawn card has ONE figbox; it matches figures[0] (the forecast plot)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })

  it('§2.5 residual-diagnostics figure is the second FigureSpec (beyond the drawn card)', () => {
    const figs = figuresOf(spec)
    expect(figs).toHaveLength(2)
    expect(figs[0]).toMatchObject({ caption: 'Forecast', file: 'forecast' })
    // §2.5 addition — not in the drawn HTML card; verified by runner test
    expect(figs[1]).toMatchObject({ file: 'residuals' })
  })

  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })

  it('HTML bundle line equals the first 3 bundleFiles; §2.5 figure_residuals.png is the 4th entry', () => {
    const htmlBundle = strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')
    expect(htmlBundle).toEqual(spec.bundleFiles.slice(0, 3))
    expect(spec.bundleFiles[3]).toBe('figure_residuals.png')
  })

  it('bundleFiles derive from table ids + figure file slugs', () => {
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

  it('options equal the inputs card option strip; order is arima-order, seasonalPeriod + horizon are number', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['arima-order', 'number', 'number'])
    expect(spec.options[0]).toMatchObject({ id: 'order', value: 'auto-select', default: true })
    expect(spec.options[1]).toMatchObject({ id: 'seasonalPeriod', default: 12 })
    expect(spec.options[2]).toMatchObject({ id: 'horizon', default: 12 })
  })

  it('time role uses timeOrder:true; series role uses excludeTag:datetime (spec §1.1 guards)', () => {
    const timeConstraint = spec.constraints.roles.find((r) => r.roleId === 'time')
    const seriesConstraint = spec.constraints.roles.find((r) => r.roleId === 'series')
    expect(timeConstraint?.timeOrder).toBe(true)
    expect(timeConstraint?.levels).toEqual([]) // timeOrder ignores levels
    expect(seriesConstraint?.excludeTag).toBe('datetime')
    expect(seriesConstraint?.levels).toEqual(['interval', 'ratio'])
  })

  it('minRule is values ≥ 20 (§1.5 — minimum 20 complete observations)', () => {
    expect(spec.constraints.minRule).toEqual({ kind: 'values', n: 20 })
  })

  it('mutation guard: changing question breaks the test (discriminates)', () => {
    const mutated = { ...spec, question: 'WRONG QUESTION' }
    expect(mutated.question).not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
