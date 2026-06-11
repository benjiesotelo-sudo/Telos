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
})
