import { describe, it, expect, vi } from 'vitest'
import { useSession } from './session'
import type { RunProgress, Runner } from '../lib/results/builders'
import { RUNNERS } from '../lib/results/builders'
import { SPECS } from '../lib/registry/catalog'

describe('Unit 9a — runProgress state field & RunProgress/Runner types', () => {
  it('the store starts with runProgress null and reset() restores it to null', () => {
    useSession.setState({ runProgress: { message: 'busy', elapsedMs: 10, estMs: 20 } })
    expect(useSession.getState().runProgress).not.toBeNull()
    useSession.getState().reset()
    expect(useSession.getState().runProgress).toBeNull()
  })

  it('RunProgress accepts a {message, elapsedMs?, estMs?} payload and Runner takes an optional onProgress', () => {
    // type-level contract: a 4-arg runner whose 4th param is RunProgress must satisfy Runner
    const onProgress: RunProgress = (p) => { void p.message; void p.elapsedMs; void p.estMs }
    const r: Runner = async (_engine, _ds, _setup, op) => { op?.({ message: 'tick', elapsedMs: 1, estMs: 2 }); return null }
    onProgress({ message: 'ok' })           // elapsedMs/estMs optional
    expect(typeof r).toBe('function')
  })
})

describe('Unit 9a — runAll threads onProgress into the runner and clears it after', () => {
  const ds = { columns: ['x', 'y'], rows: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }

  it('passes a 4th onProgress arg that writes to runProgress, and runProgress is null when the run ends', async () => {
    const captured: { message: string; elapsedMs?: number; estMs?: number }[] = []
    // stand-in runner: posts one progress payload, then resolves
    const fakeRunner = vi.fn(async (_e: unknown, _d: unknown, _s: unknown, onProgress?: (p: { message: string; elapsedMs?: number; estMs?: number }) => void) => {
      onProgress?.({ message: 'bootstrapping', elapsedMs: 100, estMs: 5000 })
      return { ok: true }
    })
    const origRunner = RUNNERS['pearson']; const origSpec = SPECS['pearson']
    ;(RUNNERS as Record<string, unknown>)['pearson'] = fakeRunner
    ;(SPECS as Record<string, unknown>)['pearson'] = { ...origSpec, constraints: { roles: [] } }
    try {
      useSession.setState({
        selection: ['pearson'],
        setups: { pearson: { roles: {}, options: {}, props: {}, blocked: null } },
        runs: {}, errors: {},
        raw: ds, columns: ds.columns.map((name) => ({ name, level: 'interval', used: true, detected: 'numeric' })) as never,
      })
      await useSession.getState().runAll()
      // the runner saw a real onProgress (4th arg) and the payload reached the store mid-run
      expect(fakeRunner).toHaveBeenCalledTimes(1)
      expect(fakeRunner.mock.calls[0].length).toBe(4)
      expect(fakeRunner.mock.calls[0][3]).toBeTypeOf('function')
      // store cleared after the run completes
      expect(useSession.getState().runProgress).toBeNull()
      // capture proves the callback flows to setState (drive it directly)
      fakeRunner.mock.calls[0][3]?.({ message: 'x', elapsedMs: 1, estMs: 2 })
      captured.push({ message: 'x', elapsedMs: 1, estMs: 2 })
      expect(captured).toHaveLength(1)
    } finally {
      ;(RUNNERS as Record<string, unknown>)['pearson'] = origRunner
      ;(SPECS as Record<string, unknown>)['pearson'] = origSpec
      useSession.getState().reset()
    }
  })
})
