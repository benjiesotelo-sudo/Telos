import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI } from './SemCanvas'
import type { SemCanvasUIProps } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'

const C = (id: number, name: string, items: string[], x = 0, y = 0): Construct =>
  ({ id, name, items, x, y })
const noop = () => {}

const baseProps: SemCanvasUIProps = {
  testId: 'test-canvas',
  constructs: [] as Construct[],
  columns: [] as string[],
  paths: [] as StructuralPath[],
  modelKind: 'latent',
  mode: 'draw',
  estimates: null,
  running: false,
  onAddPath: noop,
  onRemovePath: noop,
  onMoveNode: noop,
  onSetMode: noop,
}

function render(over: Partial<typeof baseProps>) {
  return renderToStaticMarkup(<SemCanvasUI {...baseProps} {...over} />)
}

describe('SemCanvasUI — interaction affordances', () => {
  it('renders the three-tool toolbar with Draw path / Move / Delete', () => {
    const html = render({})
    expect(html).toContain('Draw path')
    expect(html).toContain('Move')
    expect(html).toContain('Delete')
  })

  it('marks the active tool button (mode=move) with the "on" class', () => {
    const html = render({ mode: 'move' })
    // the Move button carries aria-pressed=true when it is the active tool
    expect(html).toMatch(/aria-label="Move"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/aria-label="Draw path"[^>]*aria-pressed="false"/)
  })

  it('latent mode renders one oval (ellipse) per construct, tagged with a numeric data-node-id', () => {
    const constructs = [C(1, 'Engagement', ['q1', 'q2'], 120, 80), C(2, 'Loyalty', ['q3', 'q4'], 360, 80)]
    const html = render({ constructs })
    expect(html).toContain('<ellipse')
    expect(html).toContain('data-node-id="1"')
    expect(html).toContain('data-node-id="2"')
    expect(html).toContain('Engagement')
    expect(html).toContain('Loyalty')
  })

  it('an incomplete construct (<2 items) renders muted (dashed stroke)', () => {
    const html = render({ constructs: [C(1, 'Half', ['q1'], 100, 80)] })
    expect(html).toContain('stroke-dasharray')
  })

  it('path mode renders rectangles (observed) from columns, no item boxes', () => {
    const html = render({ modelKind: 'path', columns: ['gpa', 'study', 'score'] })
    expect(html).toContain('<rect')
    expect(html).toContain('data-node-id="0"')   // path-mode node ids = column index
    expect(html).toContain('data-node-id="2"')
    expect(html).not.toContain('<ellipse')
  })

  it('renders one delete hit-target per path, tagged with its numeric index', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const paths: StructuralPath[] = [{ from: 1, to: 2 }]
    const html = render({ constructs, paths, mode: 'delete' })
    expect(html).toContain('data-path-index="0"')
  })

  it('draws a directed line per path with an arrowhead marker', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const html = render({ constructs, paths: [{ from: 1, to: 2 }] })
    expect(html).toContain('marker-end')
    expect(html).toContain('id="sem-arrow"')
  })

  it('post-run estimates annotate the path with its standardized beta', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const estimates = { paths: [{ from: 1, to: 2, beta: 0.42 }], loadings: {}, r2: { 2: 0.31 } }
    const html = render({ constructs, paths: [{ from: 1, to: 2 }], estimates })
    expect(html).toContain('β = .42')   // β on the path (APA: leading zero stripped, Task 29)
    expect(html).toContain('R² = .31')  // R² on the endogenous oval (APA)
  })

  it('disables every toolbar button while running', () => {
    const html = render({ running: true })
    const buttons = html.match(/<button[^>]*aria-label="(Draw path|Move|Delete)"[^>]*>/g) ?? []
    expect(buttons.length).toBe(3)
    expect(buttons.every((b) => b.includes('disabled'))).toBe(true)
  })
})
