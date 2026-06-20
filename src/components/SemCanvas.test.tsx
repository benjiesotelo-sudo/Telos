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

  // (I-2) Close the id=0 named risk: Map uses strict-equality so 0 must not be
  // treated as falsy when resolving path endpoints.
  it('draws an arrow for a path whose from id is 0', () => {
    const html = renderLatent({
      constructs: [
        { id: 0, name: 'Exog', items: ['x1', 'x2'], x: 80, y: 60 },
        { id: 1, name: 'Endog', items: ['y1', 'y2'], x: 320, y: 60 },
      ],
      paths: [{ from: 0, to: 1 }],
    })
    expect((html.match(/class="sem-path"/g) ?? []).length).toBe(1)
    expect(html).not.toContain('NaN')
  })
})

// ── path mode: observed rectangles, no item boxes ──────────────────────────
describe('SemCanvasUI — path mode (observed rectangles)', () => {
  it('draws a rectangle per column and no ovals/item boxes in path mode', () => {
    const html = renderLatent({
      modelKind: 'path',
      constructs: [],
      columns: ['educ', 'exper', 'wage'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }],
    })
    // 3 observed-node rectangles, 0 ovals, 0 item boxes
    expect((html.match(/class="sem-node-rect"/g) ?? []).length).toBe(3)
    expect((html.match(/<ellipse/g) ?? []).length).toBe(0)
    expect((html.match(/class="sem-item"/g) ?? []).length).toBe(0)
    // column names labelled
    expect(html).toContain('educ'); expect(html).toContain('exper'); expect(html).toContain('wage')
    // two structural arrows still drawn
    expect((html.match(/class="sem-path"/g) ?? []).length).toBe(2)
  })
})

// ── post-run estimates overlay (static annotation) ─────────────────────────
const estimates = {
  paths: [{ from: 1, to: 2, beta: 0.62 }, { from: 2, to: 3, beta: 0.48 }],
  loadings: { q1: 0.81, s1: 0.77, l1: 0.7 },
  r2: { 2: 0.39, 3: 0.23 } as Record<number, number>,
}

describe('SemCanvasUI — estimates overlay (post-run)', () => {
  it('annotates each structural path with its standardized beta', () => {
    const html = renderLatent({ estimates })
    expect(html).toContain('.62')
    expect(html).toContain('.48')
    expect((html.match(/class="sem-path-label"/g) ?? []).length).toBe(2)
  })

  it('annotates each measurement line with its loading when present', () => {
    const html = renderLatent({ estimates })
    expect(html).toContain('.81') // q1 loading on Quality
    expect(html).toContain('.77') // s1 loading on Satisfaction
    expect((html.match(/class="sem-load-label"/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('annotates endogenous ovals with R² when present', () => {
    const html = renderLatent({ estimates })
    // R² labels for constructs 2 and 3
    expect(html).toContain('R²')
    expect(html).toContain('.39'); expect(html).toContain('.23')
    expect((html.match(/class="sem-r2-label"/g) ?? []).length).toBe(2)
  })

  it('draws no estimate labels when estimates is null', () => {
    const html = renderLatent({ estimates: null })
    expect(html).not.toContain('class="sem-path-label"')
    expect(html).not.toContain('class="sem-r2-label"')
  })
})
