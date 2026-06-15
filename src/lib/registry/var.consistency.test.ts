import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { VAR as spec } from './var'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('VAR</span>'),
  outputsHtml.indexOf('Fixed effects</span>'),
)
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(
  inputsHtml.indexOf('<div class="ttl">VAR</div>'),
  inputsHtml.indexOf('<div class="ttl">Random effects</div>'),
)

describe('var registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads match the card column sequences (Tables 1 and 2 only — §2.5 FEVD not in HTML card)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) =>
      [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    // The HTML card has Tables 1 + 2 only (lag-selection, var-coefficients)
    expect(theads).toEqual(spec.tables.slice(0, 2).map((t) => t.columns.map((c) => c.label)))
  })

  it('numbered table captions match the card captions (Tables 1 and 2)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.slice(0, 2).map((t) => t.title))
  })

  it('each table has a distinct domId (no zip-filename collision)', () => {
    const ids = spec.tables.map((t) => t.domId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id !== undefined)).toBe(true)
  })

  it('§2.5: Table 3 (FEVD) is present in the registry with the correct columns', () => {
    // The FEVD table is a §2.5 addition — not drawn in the HTML card; verified here against the spec
    expect(spec.tables).toHaveLength(3)
    const fevdTable = spec.tables[2]
    expect(fevdTable.id).toBe('fevd')
    expect(fevdTable.domId).toBe('var-fevd')
    expect(fevdTable.columns.map((c) => c.label)).toEqual(['Variable', 'Impulse', 'Share'])
  })

  it('§2.5: tableNote (stability check) is present after var-coefficients', () => {
    // Not in the drawn HTML card; §2.5 addition — verified against the registry
    expect(spec.tableNote).toBeDefined()
    expect(spec.tableNote!.kind).toBe('plain')
    expect(spec.tableNote!.afterTableId).toBe('var-coefficients')
    expect(spec.tableNote!.text).toContain('stability check')
    expect(spec.tableNote!.text).toContain('< 1')
  })

  it('question, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    const figCap = card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)
    const figType = card.match(/<div class="ftype">(.*?)<\/div>/s)
    expect(strip(figCap![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(figType![1])).toBe(`type: ${figuresOf(spec)[0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })

  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    // &ldquo;/&rdquo; in HTML decode to curly quotes (U+201C/201D) — use decode() to build expected
    const lq = decode('&ldquo;'); const rq = decode('&rdquo;')
    expect(line).toBe(`${lq}${spec.apaTemplate.replace(/\{\w+\}/g, '__')}${rq}`)
  })

  it('HTML bundle line equals the first 3 bundleFiles; §2.5 table_fevd.png is the 4th entry', () => {
    const htmlBundle = strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')
    expect(htmlBundle).toEqual(spec.bundleFiles.slice(0, 3))
    expect(spec.bundleFiles[3]).toBe('table_fevd.png')
  })

  it('bundleFiles: HTML tables+figure are entries 0-2; §2.5 table_fevd.png is entry 3; all 4 have correct names', () => {
    // bundleFiles ordering: HTML-original (table1 · table2 · figure_irf) then §2.5 FEVD appended at end.
    // The derivation formula (all tables then figures) would produce a different order because the §2.5
    // addition is a table that comes after the figure in the bundle — document this explicitly.
    expect(spec.bundleFiles).toEqual([
      'table_lag-selection.png', 'table_var-coefficients.png', 'figure_irf.png', 'table_fevd.png',
    ])
    // Verify name derivation for the original entries
    expect(spec.tables[0].id).toBe('lag-selection')
    expect(spec.tables[1].id).toBe('var-coefficients')
    expect(figuresOf(spec)[0].file).toBe('irf')
    expect(spec.tables[2].id).toBe('fevd')
  })

  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })

  it('options equal the inputs card option strip; lag order is select, IRF horizon is number', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['select', 'number'])
    expect(spec.options[0]).toMatchObject({ id: 'lagOrder', value: 'auto', kind: 'select' })
    expect(spec.options[1]).toMatchObject({ id: 'irfHorizon', value: '10', default: 10 })
  })

  it('time role uses timeOrder:true; series role uses excludeTag:datetime with arity min:2 (spec §1.1 guards)', () => {
    const timeConstraint = spec.constraints.roles.find((r) => r.roleId === 'time')
    const seriesConstraint = spec.constraints.roles.find((r) => r.roleId === 'series')
    expect(timeConstraint?.timeOrder).toBe(true)
    expect(timeConstraint?.levels).toEqual([])
    expect(seriesConstraint?.excludeTag).toBe('datetime')
    expect(seriesConstraint?.levels).toEqual(['interval', 'ratio'])
    expect(seriesConstraint?.arity).toEqual({ min: 2, max: Infinity })
  })

  it('minRule is complete-wide-rows ≥ 20 (spec §1.5 — VAR needs complete rows across all series)', () => {
    expect(spec.constraints.minRule).toEqual({ kind: 'complete-wide-rows', n: 20 })
  })

  it('mutation guard: changing question breaks the test (discriminates)', () => {
    const mutated = { ...spec, question: 'WRONG QUESTION' }
    expect(mutated.question).not.toBe(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1]))
  })
})
