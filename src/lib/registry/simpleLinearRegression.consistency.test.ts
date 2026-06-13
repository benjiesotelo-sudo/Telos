import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SIMPLE_LINEAR_REGRESSION as spec } from './simpleLinearRegression'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Simple linear regression</span>'), outputsHtml.indexOf('Multiple linear regression</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// NOTE: the inputs file draws Multiple linear FIRST — the card after Simple linear there is Logistic regression.
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Simple linear regression</div>'), inputsHtml.indexOf('<div class="ttl">Logistic regression</div>'))

describe('simple-linear-regression registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — R², β)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('the ghost intercept row pins convention 1: the β cell is EMPTY (not em-dash) on the intercept', () => {
    expect(card.includes('<tr><td>(Intercept)</td><td>&mdash;</td><td>&mdash;</td><td></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>')).toBe(true)
  })
  it('question, assume table note, how-to-read and R map match verbatim (amended R map: no broom)', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap.includes('broom')).toBe(false) // the Task-1 truth-fix holds
  })
  it('one drawn figbox ↔ two FigureSpecs sharing caption + type, file slugs fit/residuals', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(figuresOf(spec).map((g) => ({ caption: g.caption, type: g.type, file: g.file }))).toEqual([
      { caption: 'Fit & residuals — scatter', type: 'fitted-line scatter + residual diagnostic plots', file: 'fit' },
      { caption: 'Fit & residuals — diagnostics', type: 'fitted-line scatter + residual diagnostic plots', file: 'residuals' },
    ])
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slugs', () => {
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
  it('options equal the inputs card option strip; both display-only', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
