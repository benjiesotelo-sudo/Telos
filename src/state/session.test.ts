import { describe, it, expect, beforeEach } from 'vitest'
import { useSession } from './session'
import { SAMPLE } from '../lib/data/sample'
describe('session', () => {
  beforeEach(() => useSession.getState().reset())
  it('holds dataset + config; equal variance defaults OFF (Welch, per the card)', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setConfig({ outcome: 'score', group: 'group' })
    expect(useSession.getState().config.outcome).toBe('score')
    expect(useSession.getState().config.equalVariance).toBe(false)
    expect(useSession.getState().status).toBe('idle')
  })
  it('changing config invalidates a displayed result; an error clears it (Export must never capture stale/null)', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setResult({} as never)
    expect(useSession.getState().status).toBe('done')
    useSession.getState().setConfig({ outcome: 'score' })
    expect(useSession.getState().result).toBeNull()
    expect(useSession.getState().status).toBe('idle')
    useSession.getState().setResult({} as never)
    useSession.getState().setError('boom')
    expect(useSession.getState().result).toBeNull()
    expect(useSession.getState().status).toBe('error')
  })
})
