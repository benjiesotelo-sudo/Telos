import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultPreviewCard } from './ResultPreviewCard'
import type { CardContent } from '../lib/results/builders'
import { CITATIONS, effectiveStatisticalBasis } from '../lib/registry/citations'
import type { TestSetup } from '../state/session'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const base: CardContent = {
  tables: [{ spec: { id: 'one', title: 'Only table', columns: [{ key: 'a', label: 'A' }] }, rows: [{ a: '1' }] }],
  note: null, figures: [], howToRead: 'How.', apa: 'APA.', nExcluded: 0,
}
const render = (content: CardContent) => renderToStaticMarkup(
  <ResultPreviewCard index={1} name="Name" question="q?" content={content} stale={false} running={false} onRerun={() => {}} />)

describe('chassis renders each card shape (design §5)', () => {
  it('numbered caption by default, bare "Table." when captionStyle is bare', () => {
    expect(render(base)).toContain('Table 1.')
    const bare = { ...base, tables: [{ ...base.tables[0], spec: { ...base.tables[0].spec, captionStyle: 'bare' as const } }] }
    expect(render(bare)).toContain('Table.')
    expect(render(bare)).not.toContain('Table 1.')
  })
  it('note paragraph appears only when present; the exclusion line only when nExcluded > 0', () => {
    expect(render(base)).not.toContain('rows excluded')
    expect(render({ ...base, note: { kind: 'plain', text: 'note text' } })).toContain('note text')
    expect(render({ ...base, nExcluded: 2 })).toContain('2 rows excluded (missing values)')
  })
  it('renders one Figure block per figure (two-figure shape)', () => {
    const two = { ...base, figures: [{ caption: 'Shape', type: 'histogram', png }, { caption: 'Shape', type: 'qq', png }] }
    expect(render(two).match(/<b>Figure\.<\/b>/g)).toHaveLength(2)
  })
  it('sem-canvas cards with 2 figures use figureSlot ONLY for figure 0 (path diagram); figure 1 renders its own <img>', () => {
    const content = {
      ...base,
      figures: [
        { caption: 'Model', type: 'path diagram', png: new Uint8Array(0) },
        { caption: 'Simple slopes', type: 'conditional-effects plot', png: new Uint8Array([137, 80, 78, 71]) },
      ],
    } as CardContent
    const html = renderToStaticMarkup(
      <ResultPreviewCard index={1} name="CB-SEM" question="q" content={content} stale={false} running={false}
        onRerun={() => {}} figureSlot={<div data-testid="canvas-slot" />} />,
    )
    expect((html.match(/data-testid="canvas-slot"/g) ?? []).length).toBe(1) // NOT duplicated for figure 1
  })
  it('preamble tables (EFA E1/E2) caption by their fixed label; canonical numbering starts at 1 on the next table (U3-T4)', () => {
    const content: CardContent = { tables: [
      { spec: { id: 'efa-suitability', title: 'EFA suitability', columns: [], captionStyle: 'preamble', preambleLabel: 'E1' }, rows: [] },
      { spec: { id: 'efa-loadings', title: 'EFA rotated factor loadings', columns: [], captionStyle: 'preamble', preambleLabel: 'E2' }, rows: [] },
      { spec: { id: 'cfa-loadings', title: 'Measurement model', columns: [] }, rows: [] },
      { spec: { id: 'fit-indices', title: 'Fit indices', columns: [] }, rows: [] },
    ], note: null, figures: [], howToRead: '', apa: '', nExcluded: 0 }
    const html = render(content)
    expect(html).toContain('<b>Table E1.</b> EFA suitability')
    expect(html).toContain('<b>Table E2.</b> EFA rotated factor loadings')
    expect(html).toContain('<b>Table 1.</b> Measurement model') // cfa-loadings, first CANONICAL table
    expect(html).toContain('<b>Table 2.</b> Fit indices')
  })
  it('canonical numbering starts at 1 even when no preamble tables are present (EFA deselected)', () => {
    const content: CardContent = { tables: [
      { spec: { id: 'cfa-loadings', title: 'Measurement model', columns: [] }, rows: [] },
    ], note: null, figures: [], howToRead: '', apa: '', nExcluded: 0 }
    expect(render(content)).toContain('<b>Table 1.</b> Measurement model')
  })
  it('U3-T5: content.notes (labelled) renders INSTEAD OF content.note when present, bold label prefix', () => {
    const withNotes: CardContent = {
      ...base,
      note: { kind: 'plain', text: 'legacy note text - must not render' },
      notes: [{ label: 'Scope', text: 'Scope sentence.' }, { label: 'Caution', text: 'Caution sentence.' }],
    }
    const html = render(withNotes)
    expect(html).toContain('<b>Scope:</b> Scope sentence.')
    expect(html).toContain('<b>Caution:</b> Caution sentence.')
    expect(html).not.toContain('legacy note text')
  })
  it('U3-T5: a labelled note with afterTableId renders inline right after that table, not in the general area', () => {
    const content: CardContent = {
      tables: [{ spec: { id: 'one', title: 'Only table', columns: [{ key: 'a', label: 'A' }] }, rows: [{ a: '1' }] }],
      note: null, figures: [], howToRead: 'How.', apa: 'APA.', nExcluded: 0,
      notes: [{ label: 'Inline', text: 'Right after the table.', afterTableId: 'one' }, { label: 'General', text: 'At the end.' }],
    }
    const html = render(content)
    expect(html).toContain('<b>Inline:</b> Right after the table.')
    expect(html).toContain('<b>General:</b> At the end.')
    // the inline note appears before the "How to read" heading, and specifically right after the table
    expect(html.indexOf('Right after the table.')).toBeLessThan(html.indexOf('How to read this test'))
  })
  it('ColumnDef.suffix renders after the sub in the table header', () => {
    const withSuffix: CardContent = { ...base, tables: [{
      spec: { id: 'one', title: 'Only table', columns: [{ key: 'a', label: 'M', sub: 'diff', suffix: ' (adj.)' }] },
      rows: [{ a: '1.23' }],
    }] }
    const html = render(withSuffix)
    expect(html).toContain('<sub>diff</sub>')
    expect(html).toContain(' (adj.)')
    // sub comes before suffix
    expect(html.indexOf('<sub>diff</sub>')).toBeLessThan(html.indexOf(' (adj.)'))
  })
  it('renders a Statistical basis footer when citations are supplied (U7-T4)', () => {
    const citations = {
      whyThisTest: { text: 'x', refs: [] },
      statisticalBasis: [{ claim: 'Independent-samples t-test', ref: { text: 'Student (1908)...', authors: 'Student', year: '1908', title: '', source: '' } }],
    }
    const html = renderToStaticMarkup(
      <ResultPreviewCard index={1} name="Name" question="q?" content={base} stale={false} running={false} onRerun={() => {}} citations={citations} />)
    expect(html).toContain('Statistical basis')
    expect(html).toContain('Independent-samples t-test')
    expect(html).toContain('CITATIONS.txt')
  })
  it('renders nothing extra when citations is undefined', () => {
    const html = render(base)
    expect(html).not.toContain('Statistical basis')
  })
  it('U8-T1: gate explainers on populated content.values - no undefined text on live cards pre-wiring', () => {
    // RED: id has explainers registered but NO content.values defined → "Understanding the numbers" must NOT render
    const withExplainerIdButNoValues: CardContent = {
      ...base,
      values: undefined, // explicitly undefined; no explainer values wired yet (pre-U8-T3)
    }
    const htmlNoValues = renderToStaticMarkup(
      <ResultPreviewCard index={1} name="Name" question="q?" content={withExplainerIdButNoValues}
        stale={false} running={false} onRerun={() => {}} id="independent-t-test" />,
    )
    // Must not render the section
    expect(htmlNoValues).not.toContain('Understanding the numbers')
    // Must not leak undefined into the output
    expect(htmlNoValues).not.toContain('undefined')
    // Must not render TermExplainers at all
    expect(htmlNoValues).not.toContain('term-explainers')

    // GREEN: same id with content.values populated → section DOES render
    const withExplainerIdAndValues: CardContent = {
      ...base,
      values: { df: 58, t: 2.14, p: '= .036', d: '0.56', dlo: '0.11', dhi: '1.00' },
    }
    const htmlWithValues = renderToStaticMarkup(
      <ResultPreviewCard index={1} name="Name" question="q?" content={withExplainerIdAndValues}
        stale={false} running={false} onRerun={() => {}} id="independent-t-test" />,
    )
    expect(htmlWithValues).toContain('Understanding the numbers')
    expect(htmlWithValues).toContain('term-explainers')
    // The actual interpret output appears: "How many standard errors..."
    expect(htmlWithValues).toContain('standard errors')
  })
})

// Task 8: the results-card "Statistical basis" footer, resolved the same way BuiltCard
// (ResultsScreen.tsx) resolves it - CITATIONS[id] with statisticalBasis replaced by
// effectiveStatisticalBasis(id, setup) - so a conditional ref (estimator/missing-earned) shows only
// on a run that actually used that option.
describe('results-card footer - conditional method refs (Task 8)', () => {
  const setup = (overrides: Partial<TestSetup> = {}): TestSetup => ({
    roles: {}, options: {}, props: {}, blocked: null, constructs: [], paths: [], moderations: [],
    ...overrides,
  })
  const renderFooter = (id: string, s?: TestSetup) => {
    const registryCitations = CITATIONS[id]
    const citations = { ...registryCitations, statisticalBasis: effectiveStatisticalBasis(id, s) }
    return renderToStaticMarkup(
      <ResultPreviewCard index={1} name={registryCitations.whyThisTest.text} question="q?" content={base}
        stale={false} running={false} onRerun={() => {}} citations={citations} id={id} />,
    )
  }

  it('a default (untouched) cb-sem run shows the footer but no conditional refs', () => {
    const html = renderFooter('cb-sem', setup())
    expect(html).toContain('Statistical basis')
    expect(html).not.toContain('Yuan')
    expect(html).not.toContain('Muth')
    expect(html).not.toContain('Enders')
    expect(html).not.toContain('Sobel')
  })

  it.each(['cb-sem', 'path-analysis'])(
    'default-run byte-pin (%s): footer with a default-filled setup is byte-identical to no setup at all',
    (id) => {
      // Literal full-string equality (amendment (e)): ANY future conditional-ref leak into a default
      // run fails loudly, not only one that happens to contain one of the four author names above.
      expect(renderFooter(id, setup())).toBe(renderFooter(id, undefined))
    },
  )

  it('estimator MLR: footer shows Yuan-Bentler (2000) only, not the WLSMV source', () => {
    const html = renderFooter('cb-sem', setup({ options: { estimator: 'MLR' } }))
    expect(html).toContain('Yuan')
    expect(html).not.toContain('Muth')
  })

  it('estimator WLSMV: footer shows the Muthen/du Toit/Spisic (1997) source only, not Yuan-Bentler', () => {
    const html = renderFooter('cb-sem', setup({ options: { estimator: 'WLSMV' } }))
    expect(html).toContain('Muth')
    expect(html).not.toContain('Yuan')
  })

  it('missing=fiml: footer shows Enders-Bandalos (2001)', () => {
    const html = renderFooter('cb-sem', setup({ options: { missing: 'fiml' } }))
    expect(html).toContain('Enders')
  })

  it('MLR + an indirect chain: footer shows Sobel (1982); MLR alone (no chain, no moderation) does not', () => {
    const withChain = renderFooter('cb-sem', setup({ options: { estimator: 'MLR' }, paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }] }))
    expect(withChain).toContain('Sobel')
    const withoutChain = renderFooter('cb-sem', setup({ options: { estimator: 'MLR' } }))
    expect(withoutChain).not.toContain('Sobel')
  })

  it('path-analysis carries the same conditional refs as cb-sem', () => {
    const html = renderFooter('path-analysis', setup({ options: { estimator: 'WLSMV' } }))
    expect(html).toContain('Muth')
  })
})
