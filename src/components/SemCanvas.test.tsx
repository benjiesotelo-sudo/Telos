import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'

const noop = () => {}

// Three constructs: two complete (>=2 items), one incomplete (1 item).
const constructs: Construct[] = [
  { id: 1, name: 'Quality', items: ['q1', 'q2', 'q3'], x: 80, y: 60 },
  { id: 2, name: 'Satisfaction', items: ['s1', 's2'], x: 320, y: 60 },
  { id: 3, name: 'Loyalty', items: ['l1'], x: 560, y: 60 },
]
const paths: StructuralPath[] = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
]

function renderLatent(over: Partial<React.ComponentProps<typeof SemCanvasUI>> = {}) {
  return renderToStaticMarkup(
    <SemCanvasUI
      testId="cb-sem"
      constructs={constructs}
      columns={[]}
      paths={paths}
      modelKind="latent"
      mode="draw"
      estimates={null}
      running={false}
      onAddPath={noop}
      onRemovePath={noop}
      onMoveNode={noop}
      onSetMode={noop}
      {...over}
    />
  )
}

describe('SemCanvasUI — static latent (Full-AMOS) render', () => {
  it('renders the figure svg with the testId-scoped id', () => {
    const html = renderLatent()
    expect(html).toContain('id="figure-path-diagram-cb-sem"')
    expect(html).toContain('<svg')
  })

  it('draws one oval (ellipse) per construct', () => {
    const html = renderLatent()
    expect((html.match(/<ellipse/g) ?? []).length).toBe(3)
  })

  it('labels each construct oval with its name', () => {
    const html = renderLatent()
    expect(html).toContain('Quality')
    expect(html).toContain('Satisfaction')
    expect(html).toContain('Loyalty')
  })

  it('draws a rectangular item box for every item across all constructs', () => {
    const html = renderLatent()
    // 3 + 2 + 1 = 6 item boxes (rects with the item class)
    expect((html.match(/class="sem-item"/g) ?? []).length).toBe(6)
    expect(html).toContain('>q1<'); expect(html).toContain('>s2<'); expect(html).toContain('>l1<')
  })

  it('draws a measurement line per item connecting the oval to each item box', () => {
    const html = renderLatent()
    // one measurement line per item = 6
    expect((html.match(/class="sem-measure"/g) ?? []).length).toBe(6)
  })

  it('marks an incomplete construct (<2 items) oval as dashed', () => {
    const html = renderLatent()
    // exactly one incomplete construct (Loyalty, 1 item) → dashed class on its oval
    expect((html.match(/sem-oval incomplete/g) ?? []).length).toBe(1)
    // the two complete ovals carry sem-oval without incomplete
  })

  it('draws a directional path arrow per structural path, in app blue', () => {
    const html = renderLatent()
    // two structural paths → two path lines
    expect((html.match(/class="sem-path"/g) ?? []).length).toBe(2)
    // arrowhead marker defined and app-blue stroke used on paths
    expect(html).toContain('<marker')
    expect(html).toContain('#185fa5')
  })

  it('paths reference an arrowhead marker via marker-end', () => {
    const html = renderLatent()
    expect((html.match(/marker-end="url\(#sem-arrow\)"/g) ?? []).length).toBe(2)
  })

  it('falls back to a default position when a construct has no x/y', () => {
    const html = renderLatent({
      constructs: [{ id: 1, name: 'NoPos', items: ['a', 'b'] }],
      paths: [],
    })
    // still renders one oval and does not throw / emit NaN
    expect((html.match(/<ellipse/g) ?? []).length).toBe(1)
    expect(html).not.toContain('NaN')
  })

  it('renders an empty-state hint when there are no constructs and no columns', () => {
    const html = renderLatent({ constructs: [], paths: [], columns: [] })
    expect(html).toContain('Add a construct')
    expect((html.match(/<ellipse/g) ?? []).length).toBe(0)
  })
})
