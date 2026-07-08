import { stepsOf, canEnter, type SessionState } from './session'
import { CATALOG } from '../lib/registry/catalog'

export interface SubDot { step: string; label: string; aria: string; state: 'done' | 'current' | 'todo'; enabled: boolean }
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

const catalogEntry = (testId: string) => CATALOG.find((x) => x.id === testId)

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
    const enterable = own.filter(([st]) => canEnter(s, st)).map(([st]) => st)
    // a done stage targets its LAST step: back-edits land on the editing screen (configure-data), not the guide;
    // current/todo stages keep the forward flow (first enterable step)
    const firstEnterable = (state === 'done' ? enterable[enterable.length - 1] : enterable[0]) ?? null
    const sub: SubDot[] = id !== 'configure' ? [] : own.map(([st, i]) => {
      const c = catalogEntry(st.slice(5))
      const name = c?.name ?? st.slice(5)
      return {
        step: st, label: c?.short ?? name, aria: name,
        state: i < cur ? 'done' : i === cur ? 'current' : 'todo',
        enabled: !running && canEnter(s, st),
      }
    })
    const curSub = sub.findIndex((d) => d.state === 'current')
    const sublabel = state === 'current' && curSub >= 0 ? `${sub[curSub].label} · ${curSub + 1} of ${sub.length}` : null
    return { id, label, state, enabled: !running && firstEnterable !== null, firstStep: firstEnterable, sub, sublabel }
  })
  // welcome: Upload reads as current (the journey's door), nothing done
  if (cur === -1) stages[0].state = 'current'
  // Fraction is driven by the fixed 5-stage rail, NEVER by selection count: the raw `steps` array
  // grows by one entry per selected test (one `test:*` step per test), which used to leak into the
  // thread math (cur / steps.length) and made the fill overshoot with 1 test / undershoot with many.
  // Ground it in stage position instead - a segment per stage boundary - so the thread never paints
  // past the current stage's node. The lone exception is Configure's sub-dots: they legitimately
  // advance the thread WITHIN the Configure→Results segment, proportional to test 1..N progress.
  const numStages = stages.length
  const curStageIdx = stages.findIndex((st) => st.state === 'current')
  let fraction = curStageIdx < 0 ? 0 : curStageIdx / (numStages - 1)
  if (curStageIdx >= 0 && stages[curStageIdx].sub.length > 0) {
    const sub = stages[curStageIdx].sub
    const curSubIdx = sub.findIndex((d) => d.state === 'current')
    const within = curSubIdx >= 0 ? curSubIdx / sub.length : 0
    fraction = (curStageIdx + within) / (numStages - 1)
  }
  // spec §3: while a run is active the rail fill IS the live progress line and Results carries the counter
  if (running) {
    const total = s.selection.length
    const done = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale).length
    stages[4].sublabel = `running · test ${Math.min(done + 1, Math.max(total, 1))} of ${Math.max(total, 1)}`
    fraction = (numStages - 2 + (total ? done / total : 0)) / (numStages - 1)
  }
  return { stages, fraction, frac: `${Math.max(0, cur) + 1} / ${steps.length}` }
}
