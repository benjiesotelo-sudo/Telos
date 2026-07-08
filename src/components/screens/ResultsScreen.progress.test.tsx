import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultsScreen } from './ResultsScreen'

// useSession returns initial state in SSR (Zustand 5 uses getInitialState() as server snapshot);
// mock it so we control the state without relying on Zustand's SSR behaviour.
const mockState = {
  runStatus: 'idle' as 'idle' | 'running' | 'error',
  runProgress: null as { message: string; elapsedMs?: number; estMs?: number } | null,
  runPhase: null as string | null,
  runError: null as string | null,
  selection: [] as string[],
  runs: {} as Record<string, unknown>,
  errors: {} as Record<string, string>,
  runAll: vi.fn(),
}

vi.mock('../../state/session', () => ({
  useSession: () => mockState,
  workingDataset: vi.fn(),
}))

afterEach(() => {
  mockState.runStatus = 'idle'
  mockState.runProgress = null
  mockState.runPhase = null
})

describe('Unit 9a - results-screen run narration (RunModule)', () => {
  it('renders a run-card with the phase text and a width percentage when runProgress carries an estimate', () => {
    mockState.runStatus = 'running'
    mockState.runPhase = 'Bootstrapping (5000 resamples)…'
    mockState.runProgress = { message: 'Bootstrapping (5000 resamples)…', elapsedMs: 65000, estMs: 160000 }
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('run-card')
    expect(html).toContain('Bootstrapping (5000 resamples)…')
    expect(html).toContain('width:41%') // round(65000/160000*100) = 41 — the pct span's driving style
    expect(html).toContain('41%') // the pct span's rendered text
  })

  it('renders an indeterminate run-fill (no width) when runProgress has no estimate', () => {
    mockState.runStatus = 'running'
    mockState.runPhase = 'Loading the R engine…'
    mockState.runProgress = null
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('run-card')
    expect(html).toContain('Loading the R engine…')
    expect(html).toContain('run-fill indeterminate')
  })

  it('pending cards narrate their OWN state: active test gets a mini track, others wait quietly', () => {
    mockState.runStatus = 'running'
    mockState.runPhase = 'Running Independent t-test…'
    mockState.selection = ['independent-t-test', 'summary-statistics']
    const html = renderToStaticMarkup(<ResultsScreen />)
    // the active card carries its own mini progress track
    expect(html).toContain('card-running')
    // the queued card does NOT parrot the other test's phase; it waits
    expect(html).toContain('Waiting its turn…')
    expect(html.match(/Running Independent t-test…/g)!.length).toBe(1) // global module only, not repeated per card
    mockState.selection = []
  })

  it('during engine load, pending cards say they are waiting for the engine, not the raw boot message', () => {
    mockState.runStatus = 'running'
    mockState.runPhase = 'Loading ggplot2…'
    mockState.selection = ['independent-t-test', 'summary-statistics']
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('Waiting for the R engine…')
    expect(html.match(/Loading ggplot2…/g)!.length).toBe(1) // the global module narrates the boot; cards do not echo it
    mockState.selection = []
  })

  it('renders no run-card when not running', () => {
    mockState.runStatus = 'idle'
    mockState.runPhase = null
    mockState.runProgress = null
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).not.toContain('run-card')
  })
})
