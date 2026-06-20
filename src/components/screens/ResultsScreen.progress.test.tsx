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

describe('Unit 9a — results-screen progress bar', () => {
  it('renders a progressbar with the message and an elapsed/estimate readout when runProgress is set during a run', () => {
    mockState.runStatus = 'running'
    mockState.runProgress = { message: 'Bootstrapping (5000 resamples)…', elapsedMs: 65000, estMs: 160000 }
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('Bootstrapping (5000 resamples)…')
    expect(html).toContain('1:05')   // elapsed mm:ss
    expect(html).toContain('2:40')   // estimate mm:ss
  })

  it('shows no progressbar when runProgress is null', () => {
    mockState.runStatus = 'running'
    mockState.runProgress = null
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).not.toContain('role="progressbar"')
  })
})
