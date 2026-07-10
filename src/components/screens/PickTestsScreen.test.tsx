import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PickTestsScreen } from './PickTestsScreen'
import type { ColumnMeta } from '../../lib/data/columnMeta'

// useSession returns initial state in SSR (Zustand 5 uses getInitialState() as server snapshot);
// mock it so we control selection/columns without relying on Zustand's SSR behaviour (same pattern
// as ResultsScreen.progress.test.tsx). CATALOG/SPECS/testEligibility stay REAL: an empty columns list
// makes every catalog entry ineligible (v.ok === false for all 48), which is exactly the launch-day
// shape — a re-upload whose columns don't fit any assigned role.
const mockState = {
  columns: [] as ColumnMeta[],
  selection: ['independent-t-test'] as string[],
  toggleSelection: vi.fn(),
  goTo: vi.fn(),
}

vi.mock('../../state/session', () => ({
  useSession: () => mockState,
  workingDataset: () => ({ columns: [], rows: [] }),
}))

// Pull the <input type="checkbox" .../>Label pair for a given accessible label out of the SSR markup.
function checkboxFor(html: string, label: string): string {
  const re = /<input type="checkbox"([^]*?)\/>([^<]*)<\/label>/g
  for (const m of html.matchAll(re)) if (m[2].trim() === label) return m[1]
  throw new Error(`no checkbox found for label "${label}"`)
}

describe('PickTestsScreen (launch-day fix: a selected test is always unselectable)', () => {
  it('a CHECKED test whose columns vanished (v.ok=false) renders its checkbox enabled, not disabled', () => {
    mockState.selection = ['independent-t-test']
    const html = renderToStaticMarkup(<PickTestsScreen />)
    const attrs = checkboxFor(html, 'Independent t-test')
    expect(attrs).toContain('checked')
    expect(attrs).not.toContain('disabled')
  })
  it('an UNCHECKED test with v.ok=false stays disabled (selecting an ineligible test is still blocked)', () => {
    mockState.selection = ['independent-t-test'] // Pearson is not selected and has no eligible columns
    const html = renderToStaticMarkup(<PickTestsScreen />)
    const attrs = checkboxFor(html, 'Pearson')
    expect(attrs).toContain('disabled')
    expect(attrs).not.toContain('checked')
  })
})
