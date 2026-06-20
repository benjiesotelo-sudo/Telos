import { describe, it, expect } from 'vitest'
import { useSession } from './session'
import type { RunProgress, Runner } from '../lib/results/builders'

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
