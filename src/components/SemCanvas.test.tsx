import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI, pathNodeCenter, NODE_W, NODE_H } from './SemCanvas'
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

// ── adaptive item-side placement ─────────────────────────────────────────────
// Constructs span all three zones of a W=760 viewBox:
//   Quality   cx=146 < 760*0.34=258.4  → LEFT  (items to the left of the oval)
//   Satisfy   cx=386 between thresholds → BELOW (items below the oval)
//   Loyalty   cx=626 > 760*0.66=501.6  → RIGHT (items to the right of the oval)
// With the old always-left code Quality and Loyalty items share the same x
// and Satisfaction items land to the LEFT of the oval too — all three fail.
describe('SemCanvasUI — adaptive item-side placement', () => {
  const sideConstructs: Construct[] = [
    { id: 1, name: 'Quality',    items: ['q1', 'q2'], x: 80,  y: 128 },  // cx=146 → left zone
    { id: 2, name: 'Satisfy',   items: ['s1', 's2'], x: 320, y: 128 },  // cx=386 → below zone
    { id: 3, name: 'Loyalty',   items: ['l1', 'l2'], x: 560, y: 128 },  // cx=626 → right zone
  ]

  it('items of a left-zone construct render to the LEFT of its oval (ix < oval-left)', () => {
    // Quality oval left edge = cx - NODE_W/2 = 146 - 66 = 80
    // Items must have x < 80 (they are to the left of the oval)
    const html = renderLatent({ constructs: sideConstructs, paths: [] })
    // Extract all sem-item rect x values from Quality's group.
    // We check that at least one item rect's x attribute is < 80 (the oval's left).
    // Strategy: grab all x="<number>" from the full render and ensure the smallest
    // is below 80 (only left-placed items would be that far left).
    const xMatches = [...html.matchAll(/class="sem-item" x="([^"]+)"/g)]
    const xs = xMatches.map((m) => parseFloat(m[1]))
    // At least some items must be to the left of Quality's oval (x < 80)
    expect(xs.some((x) => x < 80)).toBe(true)
  })

  it('items of a right-zone construct render to the RIGHT of its oval (ix > oval-right)', () => {
    // Loyalty oval right edge = cx + NODE_W/2 = 626 + 66 = 692
    // Items to the right of oval will have x > 692
    const html = renderLatent({ constructs: sideConstructs, paths: [] })
    const xMatches = [...html.matchAll(/class="sem-item" x="([^"]+)"/g)]
    const xs = xMatches.map((m) => parseFloat(m[1]))
    // At least some items must be to the right of Loyalty's oval (x > 692)
    expect(xs.some((x) => x > 692)).toBe(true)
  })

  it('items of a middle/below-zone construct render BELOW its oval (iy > oval-bottom)', () => {
    // Satisfy oval bottom = cy + NODE_H/2 = 160 + 32 = 192
    // Below-placed items must have y > 192
    const html = renderLatent({ constructs: sideConstructs, paths: [] })
    const yMatches = [...html.matchAll(/class="sem-item" x="[^"]+" y="([^"]+)"/g)]
    const ys = yMatches.map((m) => parseFloat(m[1]))
    // At least some items must be below Satisfy's oval bottom (y > 192)
    expect(ys.some((y) => y > 192)).toBe(true)
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

// ── path mode: grid layout keeps every node inside the viewBox (clickable) ──
// Regression: the old fixed-pitch layout (DEFAULT_X + i*(NODE_W+120)) pushed nodes from
// index ~3 outside the 720-wide viewBox → unclickable. A path model commonly has 3–9
// observed variables (scale.csv has 9), so the normal case must fit + stay non-overlapping.
describe('SemCanvasUI — path-mode grid layout fits the viewBox', () => {
  const VB_W = 720
  const VB_H = 320

  it('every node rectangle is fully within [0,W]×[0,H] for N up to 9', () => {
    for (let count = 1; count <= 9; count++) {
      for (let i = 0; i < count; i++) {
        const c = pathNodeCenter(i, count, VB_W, VB_H)
        // full rectangle extents (not just the center) must lie inside the viewBox
        expect(c.left, `n=${count} i=${i} left`).toBeGreaterThanOrEqual(0)
        expect(c.top, `n=${count} i=${i} top`).toBeGreaterThanOrEqual(0)
        expect(c.left + NODE_W, `n=${count} i=${i} right`).toBeLessThanOrEqual(VB_W)
        expect(c.top + NODE_H, `n=${count} i=${i} bottom`).toBeLessThanOrEqual(VB_H)
        // centers (used as path endpoints + click pivots) are inside too
        expect(c.cx).toBeGreaterThanOrEqual(0); expect(c.cx).toBeLessThanOrEqual(VB_W)
        expect(c.cy).toBeGreaterThanOrEqual(0); expect(c.cy).toBeLessThanOrEqual(VB_H)
      }
    }
  })

  it('no two of the 9 node rectangles overlap unusably (centers stay distinct + spaced)', () => {
    const count = 9
    const cs = Array.from({ length: count }, (_, i) => pathNodeCenter(i, count, VB_W, VB_H))
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        const dx = Math.abs(cs[a].cx - cs[b].cx)
        const dy = Math.abs(cs[a].cy - cs[b].cy)
        // rectangles must not fully coincide: separated on at least one axis by a node extent
        expect(dx >= NODE_W || dy >= NODE_H, `nodes ${a},${b} overlap (dx=${dx} dy=${dy})`).toBe(true)
      }
    }
  })

  it('places index ≥3 nodes inside the viewBox (the previously-overflowing region)', () => {
    // 4 columns: with the old fixed pitch, node 3 sat at left = 80 + 3*252 = 836 > 720 (off-canvas).
    const c3 = pathNodeCenter(3, 4, VB_W, VB_H)
    expect(c3.left + NODE_W).toBeLessThanOrEqual(VB_W)
    expect(c3.cx).toBeLessThanOrEqual(VB_W)
  })

  it('renders all 9 column rectangles with in-bounds x/y in a 9-column path render', () => {
    const html = renderLatent({
      modelKind: 'path',
      constructs: [],
      columns: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'],
      paths: [{ from: 0, to: 8 }, { from: 3, to: 6 }],
      viewBox: { x: 0, y: 0, w: VB_W, h: VB_H },
    })
    const rects = [...html.matchAll(/class="sem-node-rect" data-node-id="\d+" x="([^"]+)" y="([^"]+)"/g)]
    expect(rects.length).toBe(9)
    for (const m of rects) {
      const x = parseFloat(m[1]); const y = parseFloat(m[2])
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + NODE_W).toBeLessThanOrEqual(VB_W)
      expect(y + NODE_H).toBeLessThanOrEqual(VB_H)
    }
    expect(html).not.toContain('NaN')
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
