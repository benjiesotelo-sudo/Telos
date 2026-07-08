import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSession } from './session'
import { railModel } from './stages'
import type { Dataset } from '../lib/stats/types'

vi.mock('../lib/webr/getEngine', () => ({ getEngine: vi.fn(async () => ({} as never)) }))

const ds: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
] }
const load = () => useSession.getState().loadDataset(ds, { name: 'study.csv', rows: 6, cols: 2, encoding: 'UTF-8' })

describe('railModel', () => {
  beforeEach(() => { useSession.getState().reset() })

  it('always yields the five stages in order', () => {
    const m = railModel(useSession.getState())
    expect(m.stages.map((st) => st.id)).toEqual(['upload', 'data', 'pick', 'configure', 'results'])
    expect(m.stages.map((st) => st.label)).toEqual(['Upload', 'Data', 'Pick tests', 'Configure', 'Results'])
  })

  it('maps guide + configure-data into the Data stage and marks done/current/todo correctly', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().goTo('configure-data')
    const m = railModel(useSession.getState())
    expect(m.stages[0].state).toBe('done')      // upload
    expect(m.stages[1].state).toBe('current')   // data (currently on configure-data)
    expect(m.stages[2].state).toBe('todo')
  })

  it('a done Data stage targets configure-data - back-edits land on the editing screen, not the guide', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().goTo('configure-data')
    useSession.getState().goTo('pick-tests')
    const m = railModel(useSession.getState())
    expect(m.stages[1].state).toBe('done')
    expect(m.stages[1].firstStep).toBe('configure-data')
  })

  it('per-test sub-dots live in Configure with a plain-words counter', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test')
    useSession.getState().toggleSelection('one-way-anova')
    useSession.getState().goTo('pick-tests')
    useSession.getState().addRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'group', 'group')
    useSession.getState().goTo('test:one-way-anova')
    const m = railModel(useSession.getState())
    const cfg = m.stages[3]
    expect(cfg.state).toBe('current')
    expect(cfg.sub).toHaveLength(2)
    expect(cfg.sub[0].state).toBe('done')
    expect(cfg.sub[1].state).toBe('current')
    expect(cfg.sublabel).toMatch(/2 of 2/)
    // visual labels stay short, but aria-labels carry the full catalog name (e2e + screen readers know tests by name)
    expect(cfg.sub[0].label).toBe('t-test')
    expect(cfg.sub[0].aria).toBe('Independent t-test')
    expect(cfg.sub[1].label).toBe('One-way ANOVA')
    expect(cfg.sub[1].aria).toBe('One-way ANOVA + post-hoc')
  })

  it('fraction advances with the journey and stages disable while running', () => {
    load(); useSession.getState().visitGuide()
    const before = railModel(useSession.getState()).fraction
    useSession.getState().goTo('configure-data')
    const after = railModel(useSession.getState()).fraction
    expect(after).toBeGreaterThan(before)
    useSession.setState({ runStatus: 'running' })
    expect(railModel(useSession.getState()).stages.every((st) => !st.enabled)).toBe(true)
  })

  it('welcome yields fraction 0 and Upload current', () => {
    const m = railModel(useSession.getState())
    expect(m.stages[0].state).toBe('current')
    expect(m.fraction).toBe(0)
  })

  it('thread fraction at Pick tests is identical regardless of selection count (bug: selection count must never skew a pre-Configure fraction)', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().goTo('pick-tests')
    useSession.getState().toggleSelection('independent-t-test')
    const oneSelected = railModel(useSession.getState()).fraction
    for (const id of ['paired-t-test', 'one-way-anova', 'factorial-anova', 'nested-anova', 'welch-anova']) {
      useSession.getState().toggleSelection(id)
    }
    expect(useSession.getState().selection).toHaveLength(6)
    const sixSelected = railModel(useSession.getState()).fraction
    expect(sixSelected).toBe(oneSelected)
    expect(sixSelected).toBe(2 / 4) // Pick tests is stage index 2 of 5 (0-indexed), never past its own node
  })

  it('thread fraction inside Configure never lags behind the Pick tests node, regardless of how many tests are queued', () => {
    load(); useSession.getState().visitGuide()
    for (const id of ['independent-t-test', 'paired-t-test', 'one-way-anova', 'factorial-anova', 'nested-anova', 'welch-anova']) {
      useSession.getState().toggleSelection(id)
    }
    useSession.getState().goTo('pick-tests')
    const pickFraction = railModel(useSession.getState()).fraction
    useSession.getState().goTo('test:independent-t-test')
    const configureFraction = railModel(useSession.getState()).fraction
    expect(configureFraction).toBeGreaterThan(pickFraction)
  })

  it('while running, Results carries the counter and the fill tracks run progress (spec R3/§3)', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test')
    useSession.getState().toggleSelection('one-way-anova')
    useSession.setState({ step: 'results', runStatus: 'running', runPhase: 'Running Independent t-test…' })
    const m = railModel(useSession.getState())
    expect(m.stages[4].sublabel).toBe('running · test 1 of 2')
    expect(m.fraction).toBeGreaterThan(0.7) // inside the final segment
    expect(m.fraction).toBeLessThan(1)
  })
})
