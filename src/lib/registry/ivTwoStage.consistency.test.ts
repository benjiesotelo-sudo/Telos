import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { IV_TWO_STAGE as spec } from './ivTwoStage'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Card-scoped (slice to the NEXT card title — robust to document order) so another card can't satisfy an assertion.
const sliceTo = (html: string, start: string, nextMarker: string) => {
  const a = html.indexOf(start)
  const b = html.indexOf(nextMarker, a + start.length)
  return html.slice(a, b === -1 ? undefined : b)
}
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = sliceTo(outputsHtml, '<span class="rt-name">Instrumental variables (IV / 2SLS)</span>', '<span class="rt-name">')
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = sliceTo(inputsHtml, '<div class="ttl">Instrumental variables (IV / 2SLS)</div>', '<div class="ttl">')

describe('iv-2sls registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  // modelsummary OLS|2SLS shape (design 2026-06-16): Table 2 is now a coef table (thead = ['', 'OLS', '2SLS'],
  // a GOF footer below a rule, then diagnostic span rows). Table 1 (first stage) stays a classic table.
  it('table theads match the card column sequences', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('the 2SLS table is kind:coef with OLS|2SLS models; first stage stays classic; ivreg has NO aic/bic/logLik gof', () => {
    expect(spec.tables[0].kind).toBeUndefined()
    expect(spec.tables[1].kind).toBe('coef')
    expect(spec.tables[1].models).toEqual([{ key: 'ols', label: 'OLS' }, { key: 'iv', label: '2SLS' }])
    expect(spec.tables[1].gof!.map((g) => g.key)).toEqual(['n', 'rmse', 'structF'])
    expect(spec.tables[1].gof!.some((g) => ['aic', 'bic', 'll'].includes(g.key))).toBe(false)
  })
  it('the GOF footer stub labels in the 2SLS table equal spec.tables[1].gof labels in order', () => {
    const stubs = [...card.matchAll(/<tr class="row-gof"><td>(.*?)<\/td>/g)].map((m) => strip(m[1]))
    expect(stubs).toEqual(spec.tables[1].gof!.map((g) => g.label))
  })
  it('numbered table captions match the card captions (first-stage = Table 1, 2SLS = Table 2)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('each table has a distinct domId', () => {
    const ids = spec.tables.map((t) => t.domId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id !== undefined)).toBe(true)
  })
  it('tableNote text matches the tbl-note verbatim', () => {
    const tnote = card.match(/<p class="tbl-note">(.*?)<\/p>/s)
    expect(tnote).not.toBeNull()
    expect(strip(tnote![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('plain')
    expect(spec.tableNote!.afterTableId).toBe('iv-2sls')
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
  it('options equal the inputs card option strip (no CI pill drawn — CI fixed at 95%)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'display'])
    expect(spec.options.find((o) => o.id === 'ci')).toBeUndefined()
  })
  it('iv-2sls backbone: outcome interval/ratio excludeTag, endogenous/instruments any-level, controls zero+, minRule values≥20', () => {
    const c = (id: string) => spec.constraints.roles.find((r) => r.roleId === id)
    expect(c('outcome')!.levels).toEqual(['interval', 'ratio'])
    expect(c('outcome')!.excludeTag).toBe('datetime')
    expect(c('endogenous')!.levels).toEqual(['nominal', 'ordinal', 'interval', 'ratio'])
    expect(c('instruments')!.levels).toEqual(['nominal', 'ordinal', 'interval', 'ratio'])
    expect(c('controls')!.arity).toEqual({ min: 0, max: Infinity })
    expect(spec.constraints.minRule).toEqual({ kind: 'values', n: 20 })
  })
  it('mutation guard: changing the question breaks the test', () => {
    expect('WRONG').not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
