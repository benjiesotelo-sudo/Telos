import { describe, it, expect, vi, beforeEach } from 'vitest'

// captureNode is DOM-bound (html-to-image); stub it to return a recognizable PNG and
// record the ids it was asked to raster, so we can assert the path-diagram id is captured.
const captured: string[] = []
vi.mock('../../lib/export/capture', () => ({
  captureNode: vi.fn(async (id: string) => {
    captured.push(id)
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  }),
}))

// Minimal SPECS/BUILDERS doubles: one sem-canvas test (cb-sem) so download() takes the figure branch.
vi.mock('../../lib/registry/catalog', () => ({
  SPECS: {
    'cb-sem': { name: 'CB-SEM', question: 'q', inputKind: 'sem-canvas', tables: [], figures: [] },
  },
}))
vi.mock('../../lib/results/builders', () => ({
  BUILDERS: { 'cb-sem': () => ({ tables: [], figures: [] }) },
}))

import { rasterSemFigures } from './ResultsScreen'

describe('ResultsScreen — path-diagram raster (Task 30)', () => {
  beforeEach(() => { captured.length = 0 })

  it('rasters figure-path-diagram-<id> for each fresh sem-canvas test, keyed NN_id/figure_path-diagram.png', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: true, latex: false } as Parameters<typeof rasterSemFigures>[2], files)
    expect(captured).toContain('figure-path-diagram-cb-sem')
    expect(Object.keys(files)).toContain('01_cb-sem/figure_path-diagram.png')
  })

  it('also writes the figures/ latex copy when latex is ticked', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: false, latex: true } as Parameters<typeof rasterSemFigures>[2], files)
    expect(Object.keys(files)).toContain('figures/01_cb-sem/figure_path-diagram.png')
  })

  it('does nothing when neither figures nor latex is ticked', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: false, latex: false } as Parameters<typeof rasterSemFigures>[2], files)
    expect(captured).toHaveLength(0)
    expect(Object.keys(files)).toHaveLength(0)
  })
})
