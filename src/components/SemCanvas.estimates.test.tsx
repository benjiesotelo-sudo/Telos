// src/components/SemCanvas.estimates.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI, type SemCanvasUIProps } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const constructs: Construct[] = [
  { id: 1, name: 'Ability', items: ['x1', 'x2'], x: 60, y: 80 },
  { id: 2, name: 'Quality', items: ['x3', 'x4'], x: 320, y: 80 },
]
const paths: StructuralPath[] = [{ from: 1, to: 2 }]

const estimates: CbSemResult['estimates'] = {
  paths: [{ from: 1, to: 2, beta: 0.734 }],
  loadings: { x1: 0.81, x2: 0.77, x3: 0.69, x4: 0.9 },
  r2: { 2: 0.539 },
}

const base: SemCanvasUIProps = {
  testId: 'cb-sem-estimates-test',
  constructs, columns: [], paths, modelKind: 'latent', mode: 'draw',
  estimates: null, running: false,
  onAddPath: () => {}, onRemovePath: () => {}, onMoveNode: () => {}, onSetMode: () => {},
}

describe('SemCanvasUI — post-run estimates overlay', () => {
  it('renders no estimate annotations when estimates is null', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} />)
    expect(html).not.toContain('data-beta')
    expect(html).not.toContain('data-loading')
    expect(html).not.toContain('data-r2')
  })

  it('annotates the structural path with the standardized β (2 dp)', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-beta="1-2"')
    expect(html).toContain('β = .73') // leading-zero-stripped, 2 dp
  })

  it('annotates each measurement line with its standardized loading (2 dp)', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-loading="x1"')
    expect(html).toContain('.81')
    expect(html).toContain('data-loading="x4"')
    expect(html).toContain('.90')
  })

  it('annotates endogenous ovals with R² (2 dp) and skips exogenous ones', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-r2="2"')
    expect(html).toContain('R² = .54')
    expect(html).not.toContain('data-r2="1"') // construct 1 has no r2 entry
  })

  it('keys the exported diagram svg by testId-free figure id and stays renderToStaticMarkup-pure', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('id="figure-path-diagram-')
  })
})
