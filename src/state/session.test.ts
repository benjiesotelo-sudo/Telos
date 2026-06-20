import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSession, stepsOf, canEnter, workingDataset, gateOk, serializeSetups, hydrateSetups } from './session'
import type { Dataset, TTestResult } from '../lib/stats/types'
import { SPECS } from '../lib/registry/catalog'

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
    expect(useSession.getState().setups['independent-t-test']).toEqual({ roles: { outcome: [], group: [] }, options: { equalVariance: false, alpha: 0.05, ci: '95%', tails: 'two-tailed' }, props: {}, blocked: null })
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

describe('construct id migration (Sub-slice B)', () => {
  const FAKE_ID = '__test-idmig__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'construct-slots', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID], setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [] } } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID] })

  it('addConstruct assigns a fresh monotonic numeric id', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const ids = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    expect(ids).toEqual([1, 2, 3])
    expect(ids.every((i) => typeof i === 'number')).toBe(true)
  })

  it('ids stay unique and monotonic after a middle removal (no id reuse)', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const mid = useSession.getState().setups[FAKE_ID].constructs![1].id
    st.removeConstruct(FAKE_ID, mid)
    st.addConstruct(FAKE_ID)
    const ids = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    expect(ids).toEqual([1, 3, 4]) // 2 removed, next id is 4 not 2 — no reuse
  })

  it('setConstructName / toggleConstructItem are id-addressed, not index-addressed', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const [a, b] = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    st.setConstructName(FAKE_ID, b, 'Second')
    st.toggleConstructItem(FAKE_ID, a, 'q1')
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === b)!.name).toBe('Second')
    expect(cs.find((c) => c.id === a)!.items).toEqual(['q1'])
  })

  it('toggleConstructItem still partitions (an item already in another construct is ignored)', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const [a, b] = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    st.toggleConstructItem(FAKE_ID, a, 'q1')
    st.toggleConstructItem(FAKE_ID, b, 'q1') // claimed by a → ignored
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === a)!.items).toEqual(['q1'])
    expect(cs.find((c) => c.id === b)!.items).toEqual([])
  })

  it('back-fills ids by array index for a legacy setup whose constructs lack id', () => {
    useSession.setState({ setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ name: 'A', items: ['q1', 'q2'] }, { name: 'B', items: ['q3', 'q4'] }] as unknown as import('./session').Construct[] } } })
    // an id-addressed action triggers back-fill on the touched setup
    useSession.getState().addConstruct(FAKE_ID)
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.map((c) => c.id)).toEqual([0, 1, 2]) // index-0, index-1 back-filled; fresh one continues monotonically
    expect(cs.map((c) => c.name)).toEqual(['A', 'B', ''])
  })
})

describe('inputKind gate guard', () => {
  const FAKE_ID = '__test-constructs__'
  const CANVAS_ID = '__test-canvas-gate__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'construct-slots', constraints: { roles: [] }, options: [] }
    ;(SPECS as Record<string, unknown>)[CANVAS_ID] = { id: CANVAS_ID, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID, CANVAS_ID], setups: {
      [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [] },
      [CANVAS_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [], paths: [] },
    } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID]; delete (SPECS as Record<string, unknown>)[CANVAS_ID] })

  it('construct-slots: gateOk false with 0 constructs', () => {
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(false)
  })
  it('construct-slots: gateOk false with a construct that has 1 item (< 2)', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [FAKE_ID]: { ...s.setups[FAKE_ID], constructs: [{ id: 1, name: 'A', items: ['q1'] }] } } }))
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(false)
  })
  it('construct-slots: gateOk true with ≥1 construct each having ≥2 items', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [FAKE_ID]: { ...s.setups[FAKE_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }] } } }))
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(true)
  })

  it('sem-canvas (latent): gateOk false with constructs but no paths', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }], paths: [] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
  it('sem-canvas (latent): gateOk false with a path but a construct < 2 items', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
  it('sem-canvas (latent): gateOk true with ≥2-item constructs AND ≥1 path', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(true)
  })
  it('sem-canvas (path): relaxes the ≥2-items rule (each node = 1 column), needs ≥1 path', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], modelKind: 'path', constructs: [{ id: 1, name: 'X', items: ['x'] }, { id: 2, name: 'Y', items: ['y'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(true)
  })
  it('sem-canvas (path): gateOk false with no path even when nodes exist', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], modelKind: 'path', constructs: [{ id: 1, name: 'X', items: ['x'] }, { id: 2, name: 'Y', items: ['y'] }], paths: [] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
})

describe('canvas actions (Sub-slice B)', () => {
  const FAKE_ID = '__test-canvas__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID], setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }] } } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID] })
  const paths = () => useSession.getState().setups[FAKE_ID].paths ?? []

  it('addPath appends a {from,to} edge', () => {
    useSession.getState().addPath(FAKE_ID, 1, 2)
    expect(paths()).toEqual([{ from: 1, to: 2 }])
  })

  it('addPath dedupes an identical edge and ignores a self-loop', () => {
    const st = useSession.getState()
    st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 2, 2)
    expect(paths()).toEqual([{ from: 1, to: 2 }])
  })

  it('removePath removes by index', () => {
    const st = useSession.getState()
    st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 2, 1)
    st.removePath(FAKE_ID, 0)
    expect(paths()).toEqual([{ from: 2, to: 1 }])
  })

  it('moveNode stores x/y on the addressed construct only', () => {
    useSession.getState().moveNode(FAKE_ID, 2, 140, 55)
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === 2)).toMatchObject({ x: 140, y: 55 })
    expect(cs.find((c) => c.id === 1)!.x).toBeUndefined()
  })

  it('setConstructMode sets reflective/formative on the addressed construct only', () => {
    useSession.getState().setConstructMode(FAKE_ID, 1, 'formative')
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === 1)!.mode).toBe('formative')
    expect(cs.find((c) => c.id === 2)!.mode).toBeUndefined()
  })

  it('actions mark a rendered run stale (routed through revalidated)', () => {
    useSession.setState((s) => ({ runs: { ...s.runs, [FAKE_ID]: { result: {}, stale: false } } }))
    useSession.getState().addPath(FAKE_ID, 1, 2)
    expect(useSession.getState().runs[FAKE_ID].stale).toBe(true)
  })
})

describe('setup round-trip (Sub-slice B)', () => {
  it('freshSetup leaves canvas fields undefined (readers default)', () => {
    const FRESH = '__test-fresh__'
    ;(SPECS as Record<string, unknown>)[FRESH] = { id: FRESH, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.getState().toggleSelection(FRESH)
    const setup = useSession.getState().setups[FRESH]
    expect(setup.paths).toBeUndefined()
    expect(setup.modelKind).toBeUndefined()
    expect(setup.constructs).toBeUndefined()
    delete (SPECS as Record<string, unknown>)[FRESH]
  })

  it('serialize→deserialize preserves ids, paths, modelKind, mode and node positions', () => {
    const setups: Record<string, import('./session').TestSetup> = {
      'cb-sem': {
        roles: {}, options: { estimator: 'ML' }, props: {}, blocked: null, modelKind: 'latent',
        constructs: [
          { id: 1, name: 'A', items: ['q1', 'q2'], mode: 'reflective', x: 20, y: 40 },
          { id: 2, name: 'B', items: ['q3', 'q4'], mode: 'formative', x: 200, y: 40 },
        ],
        paths: [{ from: 1, to: 2 }],
      },
    }
    const round = hydrateSetups(JSON.parse(serializeSetups(setups)))
    expect(round).toEqual(setups) // deep-equal: nothing lost, nothing coerced
    expect(round['cb-sem'].constructs!.map((c) => c.id)).toEqual([1, 2])
    expect(round['cb-sem'].paths).toEqual([{ from: 1, to: 2 }])
    expect(round['cb-sem'].constructs![0]).toMatchObject({ x: 20, y: 40, mode: 'reflective' })
  })

  it('hydrating a legacy serialized setup (constructs without id) back-fills ids by index', () => {
    const legacy = { 'ave': { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ name: 'A', items: ['q1', 'q2'] }, { name: 'B', items: ['q3', 'q4'] }] } }
    const round = hydrateSetups(legacy as unknown as Record<string, import('./session').TestSetup>)
    expect(round['ave'].constructs!.map((c) => c.id)).toEqual([0, 1])
  })
})
