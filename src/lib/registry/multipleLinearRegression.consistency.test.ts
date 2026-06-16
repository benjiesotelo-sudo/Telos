import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MULTIPLE_LINEAR_REGRESSION as spec } from './multipleLinearRegression'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Multiple linear regression</span>'), outputsHtml.indexOf('Logistic regression</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// NOTE: the inputs file draws Multiple linear FIRST in family 4 — the next inputs card is Simple linear regression.
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Multiple linear regression</div>'), inputsHtml.indexOf('<div class="ttl">Simple linear regression</div>'))

describe('multiple-linear-regression registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  // modelsummary coef table (design 2026-06-16): one stacked table merges the old Model fit + Coefficients.
  // thead = [term '', model col (1), β, VIF]; a GOF footer below a rule (the old Model fit lives here).
  it('the single coef thead equals the spec column labels (term, model (1), β, VIF)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual([spec.tables[0].columns.map((c) => c.label)])
  })
  it('the single numbered caption equals the spec table title', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual([spec.tables[0].title])
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('the GOF footer stub labels in the card equal spec.tables[0].gof labels in order', () => {
    const stubs = [...card.matchAll(/<tr class="row-gof"><td>(.*?)<\/td>/g)].map((m) => strip(m[1]))
    expect(stubs).toEqual(spec.tables[0].gof!.map((g) => g.label))
  })
  it('the ghost intercept row pins convention 1 + decision 8: β AND VIF cells EMPTY (not em-dash) on the intercept', () => {
    expect(card.includes('<tr class="row-coef"><td>(Intercept)</td><td>&mdash;</td><td></td><td></td></tr>')).toBe(true)
  })
  it('question, assume table note, BOTH figure captions + types, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    // #11: two figboxes (residual diagnostics + coefficient plot) — every fcap/ftype in card order equals figures[].
    const fcaps = [...card.matchAll(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/gs)].map((m) => strip(m[1]))
    const ftypes = [...card.matchAll(/<div class="ftype">(.*?)<\/div>/gs)].map((m) => strip(m[1]))
    expect(fcaps).toEqual(spec.figures!.map((f) => f.caption))
    expect(ftypes).toEqual(spec.figures!.map((f) => `type: ${f.type}`))
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __ (predictor X stays literal on the card)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; standardize is a default-OFF toggle (R1)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'select', 'toggle'])
    expect(spec.options[2]).toMatchObject({ id: 'standardize', default: false })
  })
  it('the standardize hint is the drawn config-guide sentence; the R2 amendment holds (no "changeable")', () => {
    const guide = strip(inCard.match(/<div class="cfgguide">(.*?)<\/p>/s)![1])
    expect(guide).toContain(spec.options[2].hint!)
    expect(guide.includes('changeable')).toBe(false)
  })
})
