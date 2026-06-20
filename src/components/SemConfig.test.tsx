// src/components/SemConfig.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemConfigUI } from './SemConfig'
import type { Construct, StructuralPath } from '../state/session'

const noop = () => {}

function renderUI(opts: {
  modelKind?: 'latent' | 'path'
  constructs?: Construct[]
  paths?: StructuralPath[]
  columns?: string[]
}) {
  return renderToStaticMarkup(
    <SemConfigUI
      testId="cb-sem"
      modelKind={opts.modelKind ?? 'latent'}
      constructs={opts.constructs ?? []}
      paths={opts.paths ?? []}
      columns={opts.columns ?? []}
      running={false}
      // canvas slot + form slot are injected by the connected SemConfig; in the
      // pure UI they are children passed through, so the test passes simple nodes.
      canvas={<div data-testid="canvas-slot">CANVAS</div>}
      form={<div data-testid="form-slot">FORM</div>}
      controls={<div data-testid="controls-slot">CONTROLS</div>}
    />
  )
}

describe('SemConfigUI — layout (latent / CB-SEM)', () => {
  it('renders the canvas region above the construct-slots form (D3: canvas on top, form below)', () => {
    const html = renderUI({ modelKind: 'latent' })
    expect(html).toContain('CANVAS')
    expect(html).toContain('FORM')
    // canvas must come before the form in document order (D3)
    expect(html.indexOf('CANVAS')).toBeLessThan(html.indexOf('FORM'))
  })

  it('renders the bespoke controls region after the form', () => {
    const html = renderUI({ modelKind: 'latent' })
    expect(html).toContain('CONTROLS')
    expect(html.indexOf('FORM')).toBeLessThan(html.indexOf('CONTROLS'))
  })

  it('shows the "recommend 3 items" advisory note for latent constructs (§3.2)', () => {
    const html = renderUI({
      modelKind: 'latent',
      constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }],
    })
    expect(html).toContain('recommend 3')
  })
})

describe('SemConfigUI — path mode (observed-only)', () => {
  it('hides the construct-slots form in path mode (nodes = single observed columns, §3.6)', () => {
    const html = renderUI({ modelKind: 'path', columns: ['x', 'm', 'y'] })
    expect(html).toContain('CANVAS')
    expect(html).not.toContain('FORM')
  })

  it('does NOT show the recommend-3 advisory in path mode (no items to recommend)', () => {
    const html = renderUI({ modelKind: 'path', columns: ['x', 'm', 'y'] })
    expect(html).not.toContain('recommend 3')
  })
})
