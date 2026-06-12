import { describe, it, expect, beforeEach } from 'vitest'
import { useSession, stepsOf, canEnter, workingDataset, gateOk } from './session'
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
    expect(useSession.getState().setups['independent-t-test']).toEqual({ roles: { outcome: [], group: [] }, options: { equalVariance: false }, props: {}, blocked: null })
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

describe('arity gates (design §3: minimums gate; optional slots never block)', () => {
  beforeEach(() => { useSession.getState().reset(); load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('summary-statistics') })
  it('{1,∞} gates on its minimum; the empty {0,1} Group-by never blocks', () => {
    expect(gateOk(useSession.getState(), 'test:summary-statistics')).toBe(false)
    useSession.getState().addRole('summary-statistics', 'variables', 'score')
    expect(gateOk(useSession.getState(), 'test:summary-statistics')).toBe(true)
  })
})

describe('select option kind', () => {
  beforeEach(() => useSession.getState().reset())
  it('select option initialises with its drawn default (o.value)', () => {
    // inject a setup whose option is a string (select kind stores value as string)
    useSession.setState((s) => ({ setups: { ...s.setups, 'fake-test': { roles: {}, options: { posthoc: 'Tukey HSD' }, props: {}, blocked: null } } }))
    expect(useSession.getState().setups['fake-test'].options.posthoc).toBe('Tukey HSD')
  })
  it('setOption accepts a string value and updates the store', () => {
    useSession.setState((s) => ({ selection: [...s.selection, 'fake-test'], setups: { ...s.setups, 'fake-test': { roles: {}, options: { posthoc: 'Tukey HSD' }, props: {}, blocked: null } } }))
    useSession.getState().setOption('fake-test', 'posthoc', 'Bonferroni')
    expect(useSession.getState().setups['fake-test'].options.posthoc).toBe('Bonferroni')
  })
  it('runStatus running disables controls (disabled flag derives from runStatus === running)', () => {
    expect(useSession.getState().runStatus).toBe('idle')
    useSession.setState({ runStatus: 'running' })
    expect(useSession.getState().runStatus).toBe('running')
  })
})

it('setProp stales every run (any config edit stales ALL runs)', () => {
  useSession.setState({ selection: ['independent-t-test'],
    setups: { 'independent-t-test': { roles: { outcome: [], group: [] }, options: {}, props: {}, blocked: null } },
    runs: { 'independent-t-test': { result: {} as never, stale: false } } })
  useSession.getState().setProp('independent-t-test', 'a', 0.4)
  expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
  expect(useSession.getState().setups['independent-t-test'].props).toEqual({ a: 0.4 })
})

describe('level-select option kind (B2 — needs the shipped logistic spec)', () => {
  const lds: Dataset = { columns: ['passed', 'pre'], rows: [
    { passed: 'no', pre: 10 }, { passed: 'yes', pre: 20 }, { passed: 'no', pre: 15 },
  ] }
  beforeEach(() => {
    useSession.getState().reset()
    useSession.getState().loadDataset(lds, { name: 'x.csv', rows: 3, cols: 2, encoding: 'UTF-8' })
    useSession.getState().visitGuide()
    useSession.getState().toggleSelection('logistic-regression')
  })
  it('initialises empty, defaults to the SECOND level on outcome assignment, clears on unassign', () => {
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('')
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('yes') // second alphabetically
    useSession.getState().setOption('logistic-regression', 'event', 'no')
    useSession.getState().removeRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('')
  })
  it('reassignment resets a user-changed choice to the default; OTHER-role edits never touch it', () => {
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().setOption('logistic-regression', 'event', 'no')
    useSession.getState().addRole('logistic-regression', 'predictors', 'pre')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('no') // predictor edit: untouched
    useSession.getState().removeRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('yes') // back to the default
  })
  it('gateOk blocks while the stored level is not a live category of the assigned column', () => {
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().addRole('logistic-regression', 'predictors', 'pre')
    expect(gateOk(useSession.getState(), 'test:logistic-regression')).toBe(true)
    useSession.getState().setOption('logistic-regression', 'event', 'maybe')
    expect(gateOk(useSession.getState(), 'test:logistic-regression')).toBe(false)
  })
})

describe('poisson exposure run gate (B1/convention 11 — needs the shipped poisson spec)', () => {
  const pds: Dataset = { columns: ['complaints', 'age', 'months'], rows: [
    { complaints: 3, age: 20, months: 5 }, { complaints: 0, age: 30, months: 0 }, { complaints: 5, age: 40, months: 7 },
  ] }
  beforeEach(() => {
    useSession.getState().reset()
    useSession.getState().loadDataset(pds, { name: 'p.csv', rows: 3, cols: 3, encoding: 'UTF-8' })
    useSession.getState().visitGuide()
    useSession.getState().toggleSelection('poisson-negative-binomial')
    useSession.getState().addRole('poisson-negative-binomial', 'outcome', 'complaints') // count-tagged int column
    useSession.getState().addRole('poisson-negative-binomial', 'predictors', 'age')
  })
  it('without an exposure the gate passes; an exposure containing 0 blocks (log offset undefined)', () => {
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(true)
    useSession.getState().addRole('poisson-negative-binomial', 'exposure', 'months')
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(false)
    useSession.getState().removeRole('poisson-negative-binomial', 'exposure', 'months')
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(true)
  })
})
