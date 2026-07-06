import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultPreviewCard } from './ResultPreviewCard'
import type { CardContent } from '../lib/results/builders'

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
      note: { kind: 'plain', text: 'legacy note text — must not render' },
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
})
