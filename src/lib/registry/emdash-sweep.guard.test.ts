import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SPECS, CATALOG } from './catalog'
import { figuresOf } from './types'
import { EXPLAINERS } from './explainers'
import { verdictClause, verdictFromBoolean } from '../format/verdict'
import { WELCOME_COPY, TERMS_COPY, UPLOAD_NOTE, SIZE_WARN_TEXT, POOL_SHELF_NOTE, POOL_TEACH, RAIL_HINT, CREDIT_SUFFIX } from '../../content/copy'

// Owner ruling (2026-07-08 em-dash sweep): em dashes in user-visible prose read as AI-generated.
// This is the regression guard - it enumerates every swept surface and asserts NO em dash ('—')
// or en-dash-as-clause-separator (' – ') survives, so a future edit can't silently reintroduce one.
//
// ALLOWLIST (the two conventions this sweep deliberately left alone, owner-notified):
//   1. The bare '—' table/APA-sentence "N/A" sentinel (fx()/DASH-style null placeholders) - this
//      guard never inspects runtime-computed result VALUES, only the static registry/copy/explainer
//      TEXT, which structurally never contains the sentinel itself.
//   2. Citation/bibliography text (src/lib/export/citations.ts, referencesBib.ts, licenses.ts,
//      src/lib/registry/citations.ts) and eponym/range en-dashes (Fornell–Larcker, Ljung–Box, 1–5)
//      - out of scope by design, not scanned here.

const EM_DASH = '—'
const EN_DASH_SEPARATOR = ' – ' // en-dash used AS a clause separator (not eponyms/ranges, which keep en-dash)

function assertClean(label: string, s: string | undefined | null) {
  if (!s) return
  expect(s, `${label} contains an em dash`).not.toContain(EM_DASH)
  expect(s, `${label} contains an en-dash clause separator`).not.toContain(EN_DASH_SEPARATOR)
}

describe('em-dash sweep guard: registry prose stays em-dash-free', () => {
  it('every TestSpec string field (question, howToRead, apaTemplate, rMap, tableNote, assumptionNote, roles, options, figures)', () => {
    for (const [id, spec] of Object.entries(SPECS)) {
      assertClean(`${id}.question`, spec.question)
      assertClean(`${id}.howToRead`, spec.howToRead)
      assertClean(`${id}.apaTemplate`, spec.apaTemplate)
      assertClean(`${id}.rMap`, spec.rMap)
      assertClean(`${id}.assumptionNote`, spec.assumptionNote)
      assertClean(`${id}.tableNote.text`, spec.tableNote?.text)
      for (const r of spec.roles) {
        assertClean(`${id}.roles[${r.id}].label`, r.label)
        assertClean(`${id}.roles[${r.id}].hint`, r.hint)
      }
      for (const o of spec.options) {
        assertClean(`${id}.options[${o.id}].label`, o.label)
        assertClean(`${id}.options[${o.id}].hint`, o.hint)
      }
      for (const t of spec.tables) {
        assertClean(`${id}.tables[${t.id}].title`, t.title)
      }
      for (const f of figuresOf(spec)) {
        assertClean(`${id}.figure.caption`, f.caption)
        assertClean(`${id}.figure.type`, f.type)
      }
    }
  })

  it('catalog notes (the PickTestsScreen hint strings)', () => {
    for (const c of CATALOG) assertClean(`catalog[${c.id}].note`, c.note)
  })

  it('explainer static meaning text (interpret() functions are runtime-computed and out of scope)', () => {
    for (const [id, entries] of Object.entries(EXPLAINERS)) {
      for (const e of entries) assertClean(`explainers[${id}].${e.key}.meaning`, e.meaning)
    }
  })

  it('app copy constants (WELCOME_COPY, TERMS_COPY, upload/size/pool/rail/credit strings)', () => {
    assertClean('WELCOME_COPY', WELCOME_COPY)
    for (const seg of TERMS_COPY) { assertClean('TERMS_COPY.b', seg.b); assertClean('TERMS_COPY.t', seg.t) }
    assertClean('UPLOAD_NOTE', UPLOAD_NOTE)
    assertClean('SIZE_WARN_TEXT', SIZE_WARN_TEXT)
    assertClean('POOL_SHELF_NOTE', POOL_SHELF_NOTE('nominal'))
    for (const [level, text] of Object.entries(POOL_TEACH)) assertClean(`POOL_TEACH.${level}`, text)
    assertClean('RAIL_HINT', RAIL_HINT)
    assertClean('CREDIT_SUFFIX', CREDIT_SUFFIX)
  })

  it('verdictClause/verdictFromBoolean (the shared assumption-verdict device) never joins with an em dash', () => {
    assertClean('verdictClause(violated)', verdictClause(0.01, 0.05, 'met', 'violated'))
    assertClean('verdictClause(met)', verdictClause(0.9, 0.05, 'met', 'violated'))
    assertClean('verdictFromBoolean(true)', verdictFromBoolean(true, 'met', 'violated'))
    assertClean('verdictFromBoolean(false)', verdictFromBoolean(false, 'met', 'violated'))
  })

  it('docs/specs/telos_ui_spec.html and docs/specs/telos_test_inputs.html carry zero em dashes (literal or entity)', () => {
    for (const file of ['docs/specs/telos_ui_spec.html', 'docs/specs/telos_test_inputs.html']) {
      const html = readFileSync(file, 'utf8')
      expect(html, `${file} has a literal em dash`).not.toContain(EM_DASH)
      expect(html, `${file} has an &mdash; entity`).not.toContain('&mdash;')
    }
  })

  it('docs/specs/telos_test_outputs.html: every surviving &mdash; is confined to the allowlisted N/A-sentinel cells/quotes', () => {
    const html = readFileSync('docs/specs/telos_test_outputs.html', 'utf8')
    expect(html, 'docs/specs/telos_test_outputs.html has a literal em dash').not.toContain(EM_DASH)
    // Strip the allowlisted sentinel shapes: ANY ghost-table <td> cell (bare, bolded, or a compound
    // GOF-span label like "Ljung–Box Q = —, p — (lag —)" - every one is a runtime-filled placeholder,
    // never authored prose), plus the two literal quoted meta-references describing the convention.
    let stripped = html
      .replace(/<td[^>]*>.*?<\/td>/g, '')
      .replace(/cells display "&mdash;" because they are filled at runtime/g, '')
      .replace(/every other table shows its column structure with "&mdash;" placeholders/g, '')
    expect(stripped, 'a non-sentinel &mdash; survived the sweep in docs/specs/telos_test_outputs.html').not.toContain('&mdash;')
  })
})
