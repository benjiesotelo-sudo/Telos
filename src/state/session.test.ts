import { describe, it, expect, beforeEach } from 'vitest'
import { useSession, stepsOf, canEnter, workingDataset } from './session'
import type { Dataset, TTestResult } from '../lib/stats/types'

const ds: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
] }
const info = { name: 'study.csv', rows: 6, cols: 2, encoding: 'UTF-8' }
const load = () => useSession.getState().loadDataset(ds, info)
const fakeRun = () => useSession.setState((s) => ({ runs: { ...s.runs, 'independent-t-test': { result: {} as TTestResult, stale: false } } }))

describe('flow gates', () => {
  beforeEach(() => useSession.getState().reset())
  it('spine derives from the selection, in order', () => {
    load(); useSession.getState().toggleSelection('independent-t-test')
    expect(stepsOf(useSession.getState())).toEqual(['welcome', 'upload', 'guide', 'configure-data', 'pick-tests', 'test:independent-t-test', 'results'])
  })
  it('future steps lock until prior gates pass', () => {
    expect(canEnter(useSession.getState(), 'guide')).toBe(false)        // nothing uploaded
    load()
    expect(canEnter(useSession.getState(), 'guide')).toBe(true)
    expect(canEnter(useSession.getState(), 'configure-data')).toBe(false) // guide not visited
    useSession.getState().visitGuide()
    expect(canEnter(useSession.getState(), 'configure-data')).toBe(true)  // levels auto-suggested → gate already satisfiable
    expect(canEnter(useSession.getState(), 'pick-tests')).toBe(true)      // every used column has a suggested level
  })
  it('configure-data gate fails while any used column lacks a level', () => {
    load(); useSession.getState().visitGuide()
    useSession.getState().setColumnLevel('score', null)
    expect(canEnter(useSession.getState(), 'pick-tests')).toBe(false)
  })
  it('goTo refuses locked steps', () => {
    useSession.getState().goTo('results')
    expect(useSession.getState().step).toBe('welcome')
  })
})

describe('back-edit invalidation (the spec navcap rules)', () => {
  beforeEach(() => { useSession.getState().reset(); load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test') })
  const assign = () => {
    useSession.getState().addRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'group', 'group')
  }
  it('selection creates a setup with the drawn defaults (equal variance OFF)', () => {
    expect(useSession.getState().setups['independent-t-test']).toEqual({ roles: { outcome: [], group: [] }, options: { equalVariance: false }, blocked: null })
  })
  it('a level edit that breaks an assigned role blocks the config with the reason and marks results stale', () => {
    assign(); fakeRun()
    useSession.getState().setColumnLevel('score', 'nominal')
    const setup = useSession.getState().setups['independent-t-test']
    expect(setup.blocked).toBe('Outcome (DV): needs an interval / ratio column')
    expect(setup.roles.outcome).toEqual(['score']) // assignment kept, marked blocked — spec: "blocked with the reason"
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().setColumnLevel('score', 'ratio')
    expect(useSession.getState().setups['independent-t-test'].blocked).toBeNull() // still-valid work kept
  })
  it('missing-policy and setOption edits mark results stale; deselection drops the run', () => {
    assign(); fakeRun()
    useSession.getState().setMissingPolicy('drop')
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    fakeRun(); useSession.getState().setOption('independent-t-test', 'equalVariance', true)
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().toggleSelection('independent-t-test')
    expect(useSession.getState().runs['independent-t-test']).toBeUndefined()
  })
  it('rename propagates to role assignments and the working dataset', () => {
    assign()
    useSession.getState().renameColumn('score', 'wage')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual(['wage'])
    expect(workingDataset(useSession.getState()).columns).toContain('wage')
  })
  it('re-upload keeps still-valid work and stales results; vanished columns block with the reason', () => {
    assign(); fakeRun()
    load() // same-schema re-upload
    expect(useSession.getState().selection).toEqual(['independent-t-test'])
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual(['score'])
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().loadDataset({ columns: ['a'], rows: [{ a: 1 }] }, { name: 'other.csv', rows: 1, cols: 1, encoding: 'UTF-8' })
    expect(useSession.getState().setups['independent-t-test'].blocked).toBe('Outcome (DV): column not found')
  })
  it('results stay locked until every selected test has all role slots filled', () => {
    expect(canEnter(useSession.getState(), 'results')).toBe(false)
    assign()
    expect(canEnter(useSession.getState(), 'results')).toBe(true)
  })
  it('removeRole empties the slot and the results gate re-locks', () => {
    assign(); fakeRun()
    useSession.getState().removeRole('independent-t-test', 'outcome', 'score')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual([])
    expect(canEnter(useSession.getState(), 'results')).toBe(false)
  })
  it('addRole enforces the arity maximum — a second column on an exactly-1 slot is refused', () => {
    useSession.getState().addRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'outcome', 'group')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual(['score'])
  })
})
