import { create } from 'zustand'
import type { Dataset } from '../lib/stats/types'
import type { Level } from '../lib/registry/types'
import type { ColumnMeta } from '../lib/data/columnMeta'
import { deriveColumns, fixType } from '../lib/data/columnMeta'
import { applyMissingPolicy, type MissingPolicy } from '../lib/data/missing'
import { slotCompatibility } from '../lib/eligibility/eligibility'
import { SPECS } from '../lib/registry/catalog'
import { RUNNERS } from '../lib/results/builders'
import { getEngine } from '../lib/webr/getEngine'
import { categoriesOf, propsArray, propsSumOk, strictlyPositive, defaultEventLevel } from '../lib/data/props'

export type StepId = 'welcome' | 'upload' | 'guide' | 'configure-data' | 'pick-tests' | `test:${string}` | 'results'
export interface FileInfo { name: string; rows: number; cols: number; encoding: string }
export interface Construct { name: string; items: string[] }
export interface TestSetup { roles: Record<string, string[]>; options: Record<string, boolean | number | string>; props: Record<string, number>; blocked: string | null; constructs?: Construct[] }
export interface TestRun { result: unknown; stale: boolean }

export interface SessionState {
  step: StepId
  raw: Dataset | null
  fileInfo: FileInfo | null
  guideVisited: boolean
  columns: ColumnMeta[]
  missingPolicy: MissingPolicy
  selection: string[]
  setups: Record<string, TestSetup>
  runs: Record<string, TestRun>
  errors: Record<string, string>          // per-test failure → readable error card; other tests' results stay intact (spec run-state rule)
  runStatus: 'idle' | 'running' | 'error'
  runPhase: string | null
  runError: string | null
  loadDataset: (d: Dataset, info: FileInfo) => void
  visitGuide: () => void
  setColumnLevel: (name: string, level: Level | null) => void
  setColumnUsed: (name: string, used: boolean) => void
  renameColumn: (name: string, next: string) => void
  applyFixType: (name: string) => void
  setMissingPolicy: (p: MissingPolicy) => void
  toggleSelection: (id: string) => void
  addRole: (testId: string, roleId: string, column: string) => void
  removeRole: (testId: string, roleId: string, column: string) => void
  setOption: (testId: string, optionId: string, value: boolean | number | string) => void
  setProp: (testId: string, category: string, value: number) => void
  addConstruct: (testId: string) => void
  removeConstruct: (testId: string, index: number) => void
  setConstructName: (testId: string, index: number, name: string) => void
  toggleConstructItem: (testId: string, index: number, item: string) => void
  goTo: (step: StepId) => void
  runAll: () => Promise<void>
  reset: () => void
}

export const stepsOf = (s: Pick<SessionState, 'selection'>): StepId[] =>
  ['welcome', 'upload', 'guide', 'configure-data', 'pick-tests', ...s.selection.map((id) => `test:${id}` as StepId), 'results']

export const workingDataset = (s: Pick<SessionState, 'raw' | 'columns' | 'missingPolicy'>): Dataset =>
  s.raw ? applyMissingPolicy(s.raw, s.columns, s.missingPolicy).dataset : { columns: [], rows: [] }

/** Is this step's own completion gate satisfied? (what it takes to move PAST it) */
export const gateOk = (s: SessionState, step: StepId): boolean => {
  if (step === 'welcome') return true
  if (step === 'upload') return s.raw !== null
  if (step === 'guide') return s.guideVisited
  if (step === 'configure-data') { const used = s.columns.filter((c) => c.used); return used.length > 0 && used.every((c) => c.level !== null) }
  if (step === 'pick-tests') return s.selection.length > 0
  if (step.startsWith('test:')) {
    const id = step.slice(5); const t = s.setups[id]; const spec = SPECS[id]
    if (!t || !spec || t.blocked || !spec.constraints.roles.every((r) => t.roles[r.roleId].length >= r.arity.min)) return false
    const propOpt = spec.options.find((o) => o.kind === 'proportions')
    if (propOpt && t.options[propOpt.id] === 'custom') {
      const col = t.roles[spec.constraints.roles[0].roleId][0]
      if (!col || !propsSumOk(propsArray(categoriesOf(workingDataset(s), col), t.props))) return false
    }
    const lvlOpt = spec.options.find((o) => o.kind === 'level-select')
    if (lvlOpt) {
      const col = t.roles[lvlOpt.fromRole!]?.[0]
      if (!col || !categoriesOf(workingDataset(s), col).includes(String(t.options[lvlOpt.id]))) return false
    }
    // Poisson exposure (design convention 11): an assigned exposure column must be strictly positive — log(exposure).
    if (id === 'poisson-negative-binomial') {
      const ex = t.roles['exposure']?.[0]
      if (ex && !strictlyPositive(workingDataset(s), ex)) return false
    }
    // AVE/CR constructs: must have ≥1 construct and every construct must have ≥2 items, or R runner crashes.
    if (spec.constructsInput) {
      const cs = t.constructs ?? []
      if (cs.length === 0 || cs.some((c) => c.items.length < 2)) return false
    }
    return true
  }
  return true // results
}

export const canEnter = (s: SessionState, target: StepId): boolean => {
  const steps = stepsOf(s); const i = steps.indexOf(target)
  return i >= 0 && steps.slice(0, i).every((st) => gateOk(s, st))
}

const freshSetup = (id: string): TestSetup => ({
  roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, []])),
  options: Object.fromEntries((SPECS[id]?.options ?? []).filter((o) => o.kind !== 'display').map((o) => [o.id,
    o.kind === 'level-select' ? '' :
    o.kind === 'select' || o.kind === 'proportions' || o.kind === 'arima-order' ? (o.default != null ? String(o.default) : o.value) : o.default!,
  ])),
  props: {},
  blocked: null,
})

/** B2: a level-select option follows its fromRole column — reset to the default (second level) on assign/reassign, '' on unassign. Edits to OTHER roles never touch the stored choice. */
const syncLevelSelect = (s: SessionState, testId: string, roleId: string, setup: TestSetup): TestSetup => {
  const opt = SPECS[testId]?.options.find((o) => o.kind === 'level-select' && o.fromRole === roleId)
  if (!opt) return setup
  const col = setup.roles[roleId][0]
  const value = col ? defaultEventLevel(categoriesOf(workingDataset(s), col)) : ''
  return { ...setup, options: { ...setup.options, [opt.id]: value } }
}

/** Re-evaluate every later gate after an upstream edit: keep still-valid work, block invalid configs
 *  with the reason, mark rendered results stale (the spec's navcap rules, in one place). */
const revalidated = (s: SessionState): Pick<SessionState, 'setups' | 'runs'> => {
  const working = workingDataset(s)
  const setups: Record<string, TestSetup> = {}
  for (const id of s.selection) {
    const spec = SPECS[id]; const prev = s.setups[id] ?? freshSetup(id)
    let blocked: string | null = null
    if (spec) outer: for (const role of spec.constraints.roles) {
      for (const colName of prev.roles[role.roleId]) {
        const verdict = slotCompatibility(role, s.columns.find((c) => c.name === colName), working)
        if (!verdict.ok) { blocked = `${spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId}: ${verdict.reason}`; break outer }
      }
    }
    setups[id] = { ...prev, blocked }
  }
  const runs = Object.fromEntries(Object.entries(s.runs)
    .filter(([id]) => s.selection.includes(id))
    .map(([id, r]) => [id, { ...r, stale: true }]))
  return { setups, runs }
}

const initial = {
  step: 'welcome' as StepId, raw: null, fileInfo: null, guideVisited: false,
  columns: [] as ColumnMeta[], missingPolicy: 'leave' as MissingPolicy,
  selection: [] as string[], setups: {} as Record<string, TestSetup>, runs: {} as Record<string, TestRun>, errors: {} as Record<string, string>,
  runStatus: 'idle' as const, runPhase: null, runError: null,
}

export const useSession = create<SessionState>((set, get) => {
  const edit = (mut: (s: SessionState) => Partial<SessionState>) =>
    set((s) => { const next = { ...s, ...mut(s) }; return { ...mut(s), ...revalidated(next) } })
  return {
    ...initial,
    // Re-upload is an earlier-step edit like any other (navcap): keep still-valid work, revalidate the rest.
    loadDataset: (d, fileInfo) => edit((s) => {
      const columns = deriveColumns(d).map((fresh) => s.columns.find((c) => c.name === fresh.name && c.detected === fresh.detected) ?? fresh)
      return { raw: d, fileInfo, columns }
    }),
    visitGuide: () => set({ guideVisited: true }),
    setColumnLevel: (name, level) => edit((s) => ({ columns: s.columns.map((c) => (c.name === name ? { ...c, level } : c)) })),
    setColumnUsed: (name, used) => edit((s) => ({ columns: s.columns.map((c) => (c.name === name ? { ...c, used } : c)) })),
    renameColumn: (name, next) => edit((s) => {
      if (!next.trim() || s.columns.some((c) => c.name === next)) return {}
      const raw = s.raw && { columns: s.raw.columns.map((c) => (c === name ? next : c)),
        rows: s.raw.rows.map((r) => { const { [name]: v, ...rest } = r; return name in r ? { ...rest, [next]: v } : r }) }
      const setups = Object.fromEntries(Object.entries(s.setups).map(([id, t]) => [id,
        { ...t, roles: Object.fromEntries(Object.entries(t.roles).map(([k, v]) => [k, v.map((c) => (c === name ? next : c))])) }]))
      return { raw, setups, columns: s.columns.map((c) => (c.name === name ? { ...c, name: next } : c)) }
    }),
    applyFixType: (name) => edit((s) => {
      if (!s.raw) return {}
      const raw = fixType(s.raw, name)
      return { raw, columns: deriveColumns(raw).map((fresh) => {
        const old = s.columns.find((c) => c.name === fresh.name)
        return fresh.name === name ? fresh : (old ?? fresh) // re-derive only the fixed column; keep user edits elsewhere
      }) }
    }),
    setMissingPolicy: (missingPolicy) => edit(() => ({ missingPolicy })),
    toggleSelection: (id) => edit((s) => {
      const selection = s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]
      const setups = { ...s.setups }; const runs = { ...s.runs }; const errors = { ...s.errors }
      if (!selection.includes(id)) { delete setups[id]; delete runs[id]; delete errors[id] } else setups[id] = freshSetup(id)
      return { selection, setups, runs, errors }
    }),
    addRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; const role = SPECS[testId]?.constraints.roles.find((r) => r.roleId === roleId)
      if (!setup || !role) return {}
      const cur = setup.roles[roleId]
      if (cur.includes(column) || cur.length >= role.arity.max) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: [...cur, column] } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
    removeRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; if (!setup) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: setup.roles[roleId].filter((c) => c !== column) } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
    setOption: (testId, optionId, value: boolean | number | string) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], options: { ...s.setups[testId].options, [optionId]: value } } },
    })),
    setProp: (testId, category, value: number) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], props: { ...s.setups[testId].props, [category]: value } } },
    })),
    addConstruct: (testId) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      return { setups: { ...s.setups, [testId]: { ...prev, constructs: [...(prev.constructs ?? []), { name: '', items: [] }] } } }
    }),
    removeConstruct: (testId, index) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = (prev.constructs ?? []).filter((_, i) => i !== index)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    setConstructName: (testId, index, name) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = (prev.constructs ?? []).map((c, i) => i === index ? { ...c, name } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    toggleConstructItem: (testId, index, item) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      // Partition: if item is in another construct, ignore
      const already = (prev.constructs ?? []).some((c, i) => i !== index && c.items.includes(item))
      if (already) return {}
      const constructs = (prev.constructs ?? []).map((c, i) => {
        if (i !== index) return c
        return { ...c, items: c.items.includes(item) ? c.items.filter((x) => x !== item) : [...c.items, item] }
      })
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    goTo: (step) => { if (canEnter(get(), step)) set({ step }) },
    runAll: async () => {
      if (get().runStatus === 'running') return // reentrancy guard: a second concurrent run would interleave writes
      set({ runStatus: 'running', runError: null, step: 'results' })
      try {
        const engine = await getEngine((m) => set({ runPhase: m }))
        set({ runPhase: 'Running analysis…' })
        const s = get(); const ds = workingDataset(s)
        for (const id of s.selection) {
          const spec = SPECS[id]; const setup = s.setups[id]
          if (!spec || !setup || setup.blocked) continue
          const runner = RUNNERS[id]
          if (!runner) continue
          set({ runPhase: `Running ${spec.name}…` })
          try {
            const result = await runner(engine, ds, setup)
            const { [id]: _drop, ...rest } = get().errors
            set({ runs: { ...get().runs, [id]: { result, stale: false } }, errors: rest })
          } catch (e) {
            // readable per-test error card on the results page; later tests still run (spec run-state rule)
            set({ errors: { ...get().errors, [id]: e instanceof Error ? e.message : String(e) } })
          }
        }
        set({ runStatus: 'idle' })
      } catch (e) { set({ runStatus: 'error', runError: e instanceof Error ? e.message : String(e) }) } // boot failure only
      finally { set({ runPhase: null }) }
    },
    reset: () => set({ ...initial }),
  }
})
