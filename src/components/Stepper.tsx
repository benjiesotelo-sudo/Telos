import { useEffect, useRef } from 'react'
import { useSession, stepsOf, canEnter, type StepId } from '../state/session'
import { CATALOG } from '../lib/registry/catalog'

const label = (st: StepId): string =>
  st === 'upload' ? 'Upload' : st === 'guide' ? 'Guide' : st === 'configure-data' ? 'Configure data'
  : st === 'pick-tests' ? 'Pick tests' : st === 'results' ? 'Results'
  : (() => { const c = CATALOG.find((c) => c.id === st.slice(5)); return c?.short ?? c?.name ?? st.slice(5) })()

export function Stepper() {
  const s = useSession()
  const curRef = useRef<HTMLButtonElement>(null)
  const steps = stepsOf(s).filter((st) => st !== 'welcome')
  const cur = s.step === 'welcome' ? -1 : steps.indexOf(s.step)
  // Keep the active node visible when the strip overflows (8+ steps) — horizontal scroll only.
  useEffect(() => { curRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [cur, s.step])
  if (s.step === 'welcome') return null
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((st, i) => (
        <span key={st} style={{ display: 'contents' }}>
          {i > 0 && <span className={`connector${i <= cur ? ' done' : ''}`} />}
          <button type="button" ref={i === cur ? curRef : undefined} className={`step${i < cur ? ' done' : ''}${i === cur ? ' current' : ''}`}
            disabled={!canEnter(s, st) || s.runStatus === 'running'} // locked steps are real disabled buttons (no silent dead clicks, skipped by Tab); ALL nav locks while an analysis runs (design rule)
            onClick={() => s.goTo(st)}
            aria-current={i === cur ? 'step' : undefined}>
            <span className="dot">{i < cur ? '✓' : i + 1}</span>{label(st)}
          </button>
        </span>
      ))}
    </nav>
  )
}
