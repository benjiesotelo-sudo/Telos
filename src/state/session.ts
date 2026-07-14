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
export interface Construct { id: number; name: string; items: string[]; mode?: 'reflective' | 'formative'; x?: number; y?: number }
export interface StructuralPath { from: number; to: number }
// moderatorId: construct id of the moderator · pathIndex: index into `paths` of the edge being moderated
export interface Moderation { id: number; moderatorId: number; pathIndex: number }
export interface NodePosition { x: number; y: number }
export interface TestSetup {
  roles: Record<string, string[]>; options: Record<string, boolean | number | string>; props: Record<string, number>; blocked: string | null
  constructs?: Construct[]; paths?: StructuralPath[]; modelKind?: 'latent' | 'path'; moderations?: Moderation[]
  // P2 shelf model (path mode only): `placed` is the ordered list of column names the user has clicked
  // onto the canvas - the ONLY source of path-mode nodes (latent mode keeps using `constructs`, untouched).
  // A node's id (as referenced by StructuralPath.from/to) is its POSITION in this array - see
  // withPathModeConstructs. `nodePositions` holds drag-moved positions keyed by column NAME (not index,
  // which shifts on removal) - the path-mode analogue of latent's Construct.x/y.
  placed?: string[]; nodePositions?: Record<string, NodePosition>
  // R7 (board-clearing slice): true while a stored 'WLSMV' estimator was auto-reset to 'ML' because
  // its enabling condition broke (see wlsmvAllowed + the revalidated() guard). Surfaces the
  // "Estimator reset to ML" hint in SemControls; cleared when eligibility returns or the user
  // picks an estimator manually (setOption).
  estimatorFallback?: boolean
}
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
  runProgress: { message: string; elapsedMs?: number; estMs?: number } | null
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
  removeConstruct: (testId: string, id: number) => void
  setConstructName: (testId: string, id: number, name: string) => void
  toggleConstructItem: (testId: string, id: number, item: string) => void
  addPath: (testId: string, from: number, to: number) => void
  removePath: (testId: string, index: number) => void
  addModeration: (testId: string, moderatorId: number, pathIndex: number) => void
  removeModeration: (testId: string, id: number) => void
  moveNode: (testId: string, id: number, x: number, y: number) => void
  setConstructMode: (testId: string, id: number, mode: 'reflective' | 'formative') => void
  placeColumn: (testId: string, column: string) => void
  removeColumn: (testId: string, column: string) => void
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
    // construct-slots (AVE/CR/EFA): ≥1 construct, every construct ≥2 items, or the R runner crashes.
    if (spec.inputKind === 'construct-slots') {
      const cs = t.constructs ?? []
      if (cs.length === 0 || cs.some((c) => c.items.length < 2)) return false
    }
    // sem-canvas (CB-SEM/PLS-SEM): need a measurement model AND ≥1 structural path.
    // Path mode (each node = 1 observed column, drawn from PLACED columns by index - P2 shelf model;
    // the construct-slots form is hidden) gates on ≥2 placed columns instead of constructs.
    if (spec.inputKind === 'sem-canvas') {
      if (t.modelKind === 'path') {
        if ((t.placed?.length ?? 0) < 2) return false   // need ≥2 placed columns to connect
      } else {
        const cs = t.constructs ?? []
        if (cs.length === 0 || cs.some((c) => c.items.length < 2)) return false
      }
      if ((t.paths?.length ?? 0) < 1) return false
    }
    return true
  }
  return true // results
}

export const canEnter = (s: SessionState, target: StepId): boolean => {
  const steps = stepsOf(s); const i = steps.indexOf(target)
  return i >= 0 && steps.slice(0, i).every((st) => gateOk(s, st))
}

/** Confirm-selection target (launch-day fix): a re-upload can leave an EARLIER-selected test blocked
 *  (its assigned columns vanished) while a LATER pick is perfectly fine. Land on the first selection
 *  entry that isn't blocked, so Confirm never drops the user onto a dead 'column not found' config.
 *  Falls back to selection[0] (unchanged legacy target) when every pick is blocked. Returns
 *  undefined on an empty selection - unreachable via Confirm (disabled when selection is empty),
 *  and the honest type keeps any future caller from assuming otherwise. */
export const firstUnblockedSelection = (s: Pick<SessionState, 'selection' | 'setups'>): string | undefined =>
  s.selection.find((id) => !s.setups[id]?.blocked) ?? s.selection[0]

/** Path-mode bridge (P2 shelf model): the canvas draws nodes/paths against `setup.placed` BY INDEX
 *  (a node's id = its position in `placed`), but the construct-slots form is hidden so setup.constructs
 *  stays empty in storage. Seed a LOCAL setup whose constructs mirror the placed-columns list, in placed
 *  order (id = index, name = column, items = [column], x/y from nodePositions when the node was moved),
 *  so path.from/to resolve to column names. No-op for latent/non-path setups → the 47 other tests pass
 *  through unchanged. Shared by both seams (runAll runner + the export emitRScript) so export ≡ app. */
export function withPathModeConstructs(setup: TestSetup): TestSetup {
  if (setup.modelKind !== 'path') return setup
  const positions = setup.nodePositions ?? {}
  const constructs = (setup.placed ?? []).map((name, i) => {
    const pos = positions[name]
    return { id: i, name, items: [name], ...(pos ? { x: pos.x, y: pos.y } : {}) }
  })
  return { ...setup, constructs }
}

/** Path mode: node identity is POSITION in `placed` (see withPathModeConstructs above), so dropping one
 *  or more placed columns must remap surviving paths' from/to indices, not just splice `placed` and hope
 *  the numbers still line up - the exact silent-rebinding failure mode the canvas→runner bridge exists
 *  to avoid. Shared by removeColumn (single node, user-driven), setColumnUsed (un-using a placed column),
 *  and revalidated() (a dataset reload can drop a placed column) so there is exactly ONE place this
 *  remap can go wrong. `dropIdx` indices are into the CURRENT `placed` array. */
function dropPlacedIndices(setup: TestSetup, dropIdx: ReadonlySet<number>): TestSetup {
  const placed = setup.placed ?? []
  if (dropIdx.size === 0) return setup
  const oldToNew = new Map<number, number>()
  const nextPlaced: string[] = []
  placed.forEach((name, i) => { if (!dropIdx.has(i)) { oldToNew.set(i, nextPlaced.length); nextPlaced.push(name) } })
  const keptPaths = (setup.paths ?? []).map((p, i) => ({ p, i })).filter(({ p }) => oldToNew.has(p.from) && oldToNew.has(p.to))
  const paths = keptPaths.map(({ p }) => ({ from: oldToNew.get(p.from)!, to: oldToNew.get(p.to)! }))
  const droppedNames = new Set(placed.filter((_, i) => dropIdx.has(i)))
  const nodePositions = setup.nodePositions
    ? Object.fromEntries(Object.entries(setup.nodePositions).filter(([name]) => !droppedNames.has(name)))
    : setup.nodePositions
  // Defensive: moderation is unreachable in path mode via the UI today (moderationGuardReason blocks the
  // gesture entirely), but this is the one designated remap site for a placed-columns drop - keep any
  // moderation that might exist consistent with the paths it references, same discipline as
  // removePath/removeConstruct (drop a moderation whose path was dropped; remap one whose path shifted).
  const pathOldToNew = new Map(keptPaths.map(({ i }, newI) => [i, newI]))
  const moderations = setup.moderations
    ? setup.moderations.filter((m) => pathOldToNew.has(m.pathIndex)).map((m) => ({ ...m, pathIndex: pathOldToNew.get(m.pathIndex)! }))
    : setup.moderations
  return { ...setup, placed: nextPlaced, paths, nodePositions, moderations }
}

/** Legacy setups stored constructs without an id (pre-Sub-slice-B). Back-fill ids by array index so
 *  existing AVE/CR/EFA work keeps running; idempotent (a construct that already has an id is untouched). */
export const backfillConstructIds = (cs: Construct[]): Construct[] =>
  cs.map((c, i) => (typeof c.id === 'number' ? c : { ...c, id: i }))

/** Round-trip helpers for persisting setups (e.g. localStorage / Supabase — forward storage seam).
 *  serialize = plain JSON; hydrate = parse + back-fill legacy construct ids by index so
 *  pre-Sub-slice-B saves keep working. Canvas fields (paths, modelKind, x/y, mode) JSON-serialize
 *  natively; undefined fields stay absent and readers default. */
export const serializeSetups = (setups: Record<string, TestSetup>): string => JSON.stringify(setups)

export const hydrateSetups = (parsed: Record<string, TestSetup>): Record<string, TestSetup> =>
  Object.fromEntries(Object.entries(parsed).map(([id, t]) => [id,
    t.constructs ? { ...t, constructs: backfillConstructIds(t.constructs) } : t]))

/** Next monotonic id for a construct list — max(existing ids, 0) + 1, so ids start at 1 and a middle removal never reuses an id. */
const nextConstructId = (cs: Construct[]): number => cs.reduce((m, c) => Math.max(m, c.id), 0) + 1
/** Same discipline for moderation edges — ids start at 1, a middle removal never reuses an id. */
const nextModerationId = (ms: Moderation[]): number => ms.reduce((m, x) => Math.max(m, x.id), 0) + 1

const freshSetup = (id: string): TestSetup => ({
  roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, []])),
  options: Object.fromEntries((SPECS[id]?.options ?? []).filter((o) => o.kind !== 'display').map((o) => [o.id,
    o.kind === 'level-select' ? '' :
    o.kind === 'select' || o.kind === 'proportions' || o.kind === 'arima-order' ? (o.default != null ? String(o.default) : o.value) : o.default!,
  ])),
  props: {},
  blocked: null,
  // Inherit the spec's model kind: path-analysis → 'path' (canvas draws column rectangles, gate uses
  // used-columns); cb-sem/pls-sem have no spec.modelKind → undefined → latent default everywhere.
  modelKind: SPECS[id]?.modelKind,
})

/** B2: a level-select option follows its fromRole column — reset to the default (second level) on assign/reassign, '' on unassign. Edits to OTHER roles never touch the stored choice. */
const syncLevelSelect = (s: SessionState, testId: string, roleId: string, setup: TestSetup): TestSetup => {
  const opt = SPECS[testId]?.options.find((o) => o.kind === 'level-select' && o.fromRole === roleId)
  if (!opt) return setup
  const col = setup.roles[roleId][0]
  const value = col ? defaultEventLevel(categoriesOf(workingDataset(s), col)) : ''
  return { ...setup, options: { ...setup.options, [opt.id]: value } }
}

/** R7 (board-clearing slice): can this setup validly hold estimator 'WLSMV'? Mirrors SemControls'
 *  option-greying condition (`hasModeration || !hasOrdinalIndicator`, Amendment B) - the two must
 *  stay in sync until T11's shared semEndogeneity helper centralizes the derivations.
 *  Latent mode: at least one construct item is ordinal-level AND no moderation edge exists
 *  (latent moderation's indProd() approach is ML-family-only). Path mode: at least one PLACED
 *  ordinal column is ENDOGENOUS (some path's `to` points at it) - lavaan only assigns thresholds
 *  to endogenous ordered variables. */
export const wlsmvAllowed = (setup: TestSetup, columns: ColumnMeta[]): boolean => {
  if ((setup.moderations ?? []).length > 0) return false
  const level = new Map(columns.map((c) => [c.name, c.level]))
  if (setup.modelKind === 'path') {
    const paths = setup.paths ?? []
    return (setup.placed ?? []).some((name, i) => level.get(name) === 'ordinal' && paths.some((p) => p.to === i))
  }
  return (setup.constructs ?? []).some((c) => c.items.some((item) => level.get(item) === 'ordinal'))
}

/** Re-evaluate every later gate after an upstream edit: keep still-valid work, block invalid configs
 *  with the reason, mark rendered results stale (the spec's navcap rules, in one place). */
const revalidated = (s: SessionState): Pick<SessionState, 'setups' | 'runs'> => {
  const working = workingDataset(s)
  const existingNames = new Set(s.columns.map((c) => c.name))
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
    let next: TestSetup = { ...prev, blocked }
    // P2 shelf model: a re-upload (loadDataset) can drop a column that was placed on a path-mode
    // canvas. Same discipline as removeColumn - remap surviving paths' indices rather than nuking the
    // whole canvas (revalidated()'s philosophy: keep what's still valid, drop only what broke).
    if (next.modelKind === 'path' && next.placed?.length) {
      const dropIdx = new Set(next.placed.reduce<number[]>((acc, name, i) => (existingNames.has(name) ? acc : [...acc, i]), []))
      if (dropIdx.size) next = dropPlacedIndices(next, dropIdx)
    }
    // R7 (board-clearing slice): a stored 'WLSMV' whose enabling condition broke resets to 'ML' the
    // moment it breaks (same reset discipline as syncLevelSelect - the stored option follows its
    // enabling inputs). Guarded HERE, not per-action: revalidated() is the one seam every edit()-routed
    // mutation flows through, so removePath/removeColumn/addModeration/setColumnLevel/toggle-item/
    // re-upload are all covered regardless of which component is mounted. `estimatorFallback` drives
    // the SemControls hint; it clears once eligibility returns (the hint would otherwise go stale).
    if (next.options.estimator === 'WLSMV' && !wlsmvAllowed(next, s.columns)) {
      next = { ...next, options: { ...next.options, estimator: 'ML' }, estimatorFallback: true }
    } else if (next.estimatorFallback && wlsmvAllowed(next, s.columns)) {
      next = { ...next, estimatorFallback: undefined }
    }
    setups[id] = next
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
  runStatus: 'idle' as const, runPhase: null, runError: null, runProgress: null,
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
    setColumnUsed: (name, used) => edit((s) => {
      const columns = s.columns.map((c) => (c.name === name ? { ...c, used } : c))
      // P2 shelf model: path-mode node identity is POSITION IN `placed`, independent of the used-columns
      // list order - toggling `used` no longer shifts any node's index. It only matters when the toggled
      // column is itself ON the canvas: un-using a placed column removes that node (paths remapped, same
      // discipline as a manual removeColumn); an unplaced column's toggle never touches any setup.
      const wasUsed = s.columns.find((c) => c.name === name)?.used
      if (wasUsed === used) return { columns } // no-op toggle → don't disturb anything
      const setups = Object.fromEntries(Object.entries(s.setups).map(([id, t]) => {
        if (t.modelKind !== 'path') return [id, t]
        const idx = (t.placed ?? []).indexOf(name)
        return idx === -1 ? [id, t] : [id, dropPlacedIndices(t, new Set([idx]))]
      }))
      return { columns, setups }
    }),
    renameColumn: (name, next) => edit((s) => {
      if (!next.trim() || s.columns.some((c) => c.name === next)) return {}
      const raw = s.raw && { columns: s.raw.columns.map((c) => (c === name ? next : c)),
        rows: s.raw.rows.map((r) => { const { [name]: v, ...rest } = r; return name in r ? { ...rest, [next]: v } : r }) }
      // P2 shelf model: a path-mode node's identity is its POSITION in `placed` (see withPathModeConstructs),
      // and its drag position is keyed by column NAME in `nodePositions` - both must be renamed in the SAME
      // pass as `roles`, symmetrically, or revalidated() sees the old name vanish from s.columns and drops
      // the node (and its paths) as "vanished" even though it just got renamed, not removed.
      // Latent `constructs[].items` are column names too and must follow the rename the same way (R12) -
      // construct NAMES are user-typed labels, never columns, so they stay untouched.
      const setups = Object.fromEntries(Object.entries(s.setups).map(([id, t]) => {
        const roles = Object.fromEntries(Object.entries(t.roles).map(([k, v]) => [k, v.map((c) => (c === name ? next : c))]))
        const constructs = t.constructs?.some((c) => c.items.includes(name))
          ? t.constructs.map((c) => (c.items.includes(name) ? { ...c, items: c.items.map((item) => (item === name ? next : item)) } : c))
          : t.constructs
        if (t.modelKind !== 'path' || !(t.placed ?? []).includes(name)) return [id, { ...t, roles, constructs }]
        const placed = t.placed!.map((c) => (c === name ? next : c))
        const nodePositions = t.nodePositions && name in t.nodePositions
          ? Object.fromEntries(Object.entries(t.nodePositions).map(([k, v]) => [k === name ? next : k, v]))
          : t.nodePositions
        return [id, { ...t, roles, constructs, placed, nodePositions }]
      }))
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
      // one column, one slot per test - cross-role reuse is never statistically meaningful here (spec 2026-07-04 R5)
      if (cur.length >= role.arity.max || Object.values(setup.roles).some((cols) => cols.includes(column))) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: [...cur, column] } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
    removeRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; if (!setup) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: setup.roles[roleId].filter((c) => c !== column) } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
    setOption: (testId, optionId, value: boolean | number | string) => edit((s) => ({
      // R7: a manual estimator pick acknowledges (clears) the auto-fallback flag; revalidated() re-sets
      // it if the picked value is 'WLSMV' while the enabling condition is still broken (defensive).
      setups: { ...s.setups, [testId]: { ...s.setups[testId], options: { ...s.setups[testId].options, [optionId]: value },
        ...(optionId === 'estimator' ? { estimatorFallback: undefined } : {}) } },
    })),
    setProp: (testId, category, value: number) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], props: { ...s.setups[testId].props, [category]: value } } },
    })),
    addConstruct: (testId) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? [])
      return { setups: { ...s.setups, [testId]: { ...prev, constructs: [...constructs, { id: nextConstructId(constructs), name: '', items: [] }] } } }
    }),
    removeConstruct: (testId, id) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).filter((c) => c.id !== id)
      // drop dangling structural paths, then re-index/drop moderations against the FILTERED paths in the same edit
      const keptPathIdx = (prev.paths ?? []).map((p, i) => ({ p, i })).filter(({ p }) => p.from !== id && p.to !== id)
      const paths = keptPathIdx.map(({ p }) => p)
      const oldToNew = new Map(keptPathIdx.map(({ i }, newI) => [i, newI]))
      const moderations = (prev.moderations ?? [])
        .filter((m) => m.moderatorId !== id && oldToNew.has(m.pathIndex))
        .map((m) => ({ ...m, pathIndex: oldToNew.get(m.pathIndex)! }))
      return { setups: { ...s.setups, [testId]: { ...prev, constructs, paths, moderations } } }
    }),
    setConstructName: (testId, id, name) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, name } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    toggleConstructItem: (testId, id, item) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? [])
      // Partition: if item is in another construct, ignore
      if (constructs.some((c) => c.id !== id && c.items.includes(item))) return {}
      const next = constructs.map((c) => c.id !== id ? c : { ...c, items: c.items.includes(item) ? c.items.filter((x) => x !== item) : [...c.items, item] })
      return { setups: { ...s.setups, [testId]: { ...prev, constructs: next } } }
    }),
    addPath: (testId, from, to) => edit((s) => {
      const prev = s.setups[testId]; if (!prev || from === to) return {} // no self-loops
      const paths = prev.paths ?? []
      if (paths.some((p) => p.from === from && p.to === to)) return {} // dedupe
      return { setups: { ...s.setups, [testId]: { ...prev, paths: [...paths, { from, to }] } } }
    }),
    removePath: (testId, index) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const paths = (prev.paths ?? []).filter((_, i) => i !== index)
      const moderations = (prev.moderations ?? [])
        .filter((m) => m.pathIndex !== index)
        .map((m) => ({ ...m, pathIndex: m.pathIndex > index ? m.pathIndex - 1 : m.pathIndex }))
      return { setups: { ...s.setups, [testId]: { ...prev, paths, moderations } } }
    }),
    addModeration: (testId, moderatorId, pathIndex) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const ms = prev.moderations ?? []
      // Dedup at the store seam: the canvas guard explains a duplicate to the user, but the store
      // is the last line of defence — double-adding the same moderator+path must be impossible.
      if (ms.some((m) => m.moderatorId === moderatorId && m.pathIndex === pathIndex)) return {}
      return { setups: { ...s.setups, [testId]: { ...prev, moderations: [...ms, { id: nextModerationId(ms), moderatorId, pathIndex }] } } }
    }),
    removeModeration: (testId, id) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      return { setups: { ...s.setups, [testId]: { ...prev, moderations: (prev.moderations ?? []).filter((m) => m.id !== id) } } }
    }),
    moveNode: (testId, id, x, y) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      // Path mode: node id is a POSITION in `placed` (shifts on removal), so positions are keyed by the
      // column NAME instead - resolve id → name via the CURRENT placed array at move time.
      if (prev.modelKind === 'path') {
        const name = (prev.placed ?? [])[id]; if (name === undefined) return {}
        return { setups: { ...s.setups, [testId]: { ...prev, nodePositions: { ...prev.nodePositions, [name]: { x, y } } } } }
      }
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, x, y } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    setConstructMode: (testId, id, mode) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, mode } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    // P2 shelf model: clicking a shelf chip places its column onto the path-mode canvas. Auto-position
    // is derived at render time from the node's index in `placed` (the SAME undefined-x/y-means-default
    // convention latent mode already uses for a freshly-added construct) - no pixel position is written
    // here. Appends to the end (next free spot); a column already placed is a no-op (idempotent).
    placeColumn: (testId, column) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const placed = prev.placed ?? []
      // Store-level last-line-of-defence guard (matches the discipline elsewhere in this file): a stale
      // shelf chip for a column that vanished (re-upload) or is already on the canvas is a no-op.
      if (placed.includes(column) || !s.columns.some((c) => c.name === column)) return {}
      return { setups: { ...s.setups, [testId]: { ...prev, placed: [...placed, column] } } }
    }),
    // P2 shelf model: "delete = back to the shelf" - drop the node AND every path touching it, remapping
    // survivors so they keep pointing at the same columns (see dropPlacedIndices). Not found → no-op.
    removeColumn: (testId, column) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const idx = (prev.placed ?? []).indexOf(column)
      if (idx === -1) return {}
      return { setups: { ...s.setups, [testId]: dropPlacedIndices(prev, new Set([idx])) } }
    }),
    goTo: (step) => { if (canEnter(get(), step)) set({ step }) },
    runAll: async () => {
      if (get().runStatus === 'running') return // reentrancy guard: a second concurrent run would interleave writes
      set({ runStatus: 'running', runError: null, step: 'results' })
      try {
        const engine = await getEngine((m) => set({ runPhase: m }))
        set({ runPhase: 'Running analysis…' })
        const s = get(); const ds = workingDataset(s)
        // H1 wiring: Configure-data measurement levels flow to the runners as a plain name->level map
        // (CB-SEM/path-analysis read it for WLSMV's `ordered = c(...)` auto-declaration via semFitArgs;
        // all other runners ignore the extra argument). Unset levels (null) are simply absent.
        const columnLevels = Object.fromEntries(
          s.columns.filter((c) => c.level !== null).map((c) => [c.name, c.level as string]),
        )
        for (const id of s.selection) {
          const spec = SPECS[id]; const setup = s.setups[id]
          if (!spec || !setup || setup.blocked) continue
          const runner = RUNNERS[id]
          if (!runner) continue
          set({ runPhase: `Running ${spec.name}…`, runProgress: null })
          // single progress channel into the results-screen bar (SEM bootstrap posts elapsed/est here)
          const onProgress = (p: { message: string; elapsedMs?: number; estMs?: number }) =>
            set({ runProgress: p })
          try {
            // Path mode (P2 shelf model): the canvas draws nodes/paths against setup.placed BY INDEX, but
            // the construct-slots form is hidden so setup.constructs is empty. Seed the runner with
            // constructs synthesized from the placed-columns list so path.from/to resolve to column
            // names. Derive a LOCAL runSetup (don't mutate the stored setup - keeps the canvas/state
            // clean; withPathModeConstructs is a no-op for non-path setups).
            const runSetup = withPathModeConstructs(setup)
            const result = await runner(engine, ds, runSetup, onProgress, columnLevels)
            const rest = { ...get().errors }; delete rest[id]
            set({ runs: { ...get().runs, [id]: { result, stale: false } }, errors: rest })
          } catch (e) {
            // readable per-test error card on the results page; later tests still run (spec run-state rule)
            set({ errors: { ...get().errors, [id]: e instanceof Error ? e.message : String(e) } })
          }
        }
        set({ runStatus: 'idle' })
      } catch (e) { set({ runStatus: 'error', runError: e instanceof Error ? e.message : String(e) }) } // boot failure only
      finally { set({ runPhase: null, runProgress: null }) }
    },
    reset: () => set({ ...initial }),
  }
})
