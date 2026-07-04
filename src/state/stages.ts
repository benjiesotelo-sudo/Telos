import { stepsOf, canEnter, type SessionState } from './session'
import { CATALOG } from '../lib/registry/catalog'

export interface SubDot { step: string; label: string; state: 'done' | 'current' | 'todo'; enabled: boolean }
export interface Stage { id: 'upload' | 'data' | 'pick' | 'configure' | 'results'; label: string;
  state: 'done' | 'current' | 'todo'; enabled: boolean; firstStep: string | null;
  sub: SubDot[]; sublabel: string | null }
export interface RailModel { stages: Stage[]; fraction: number; frac: string }

const GROUPS: [Stage['id'], string, (st: string) => boolean][] = [
  ['upload', 'Upload', (st) => st === 'upload'],
  ['data', 'Data', (st) => st === 'guide' || st === 'configure-data'],
  ['pick', 'Pick tests', (st) => st === 'pick-tests'],
  ['configure', 'Configure', (st) => st.startsWith('test:')],
  ['results', 'Results', (st) => st === 'results'],
]

const shortName = (testId: string) => {
  const c = CATALOG.find((x) => x.id === testId)
  return c?.short ?? c?.name ?? testId
}

/** Presentation model for the stage rail. Pure: navigation gates stay in canEnter/goTo. */
export function railModel(s: SessionState): RailModel {
  const steps = stepsOf(s).filter((st) => st !== 'welcome')
  const cur = s.step === 'welcome' ? -1 : steps.indexOf(s.step)
  const running = s.runStatus === 'running'
  const stages = GROUPS.map(([id, label, match]): Stage => {
    const own = steps.map((st, i) => [st, i] as const).filter(([st]) => match(st))
    const idxs = own.map(([, i]) => i)
    const state: Stage['state'] = !idxs.length || cur < idxs[0]
      ? (id === 'upload' && cur <= 0 && (cur === 0 || s.step === 'welcome') ? 'current' : 'todo')
      : cur > idxs[idxs.length - 1] ? 'done' : 'current'
    const firstEnterable = own.find(([st]) => canEnter(s, st))?.[0] ?? null
    const sub: SubDot[] = id !== 'configure' ? [] : own.map(([st, i]) => ({
      step: st, label: shortName(st.slice(5)),
      state: i < cur ? 'done' : i === cur ? 'current' : 'todo',
      enabled: !running && canEnter(s, st),
    }))
    const curSub = sub.findIndex((d) => d.state === 'current')
    const sublabel = state === 'current' && curSub >= 0 ? `${sub[curSub].label} · ${curSub + 1} of ${sub.length}` : null
    return { id, label, state, enabled: !running && firstEnterable !== null, firstStep: firstEnterable, sub, sublabel }
  })
  // welcome: Upload reads as current (the journey's door), nothing done
  if (cur === -1) stages[0].state = 'current'
  let fraction = steps.length > 1 ? Math.max(0, cur) / (steps.length - 1) : 0
  // spec §3: while a run is active the rail fill IS the live progress line and Results carries the counter
  if (running) {
    const total = s.selection.length
    const done = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale).length
    stages[4].sublabel = `running · test ${Math.min(done + 1, Math.max(total, 1))} of ${Math.max(total, 1)}`
    if (steps.length > 1) fraction = (steps.length - 2 + (total ? done / total : 0)) / (steps.length - 1)
  }
  return { stages, fraction, frac: `${Math.max(0, cur) + 1} / ${steps.length}` }
}
