import { useSession, stepsOf, type StepId } from '../state/session'
import { CATALOG } from '../lib/registry/catalog'

const label = (st: StepId): string =>
  st === 'upload' ? 'Upload' : st === 'guide' ? 'Guide' : st === 'configure-data' ? 'Configure data'
  : st === 'pick-tests' ? 'Pick tests' : st === 'results' ? 'Results'
  : (() => { const c = CATALOG.find((c) => c.id === st.slice(5)); return c?.short ?? c?.name ?? st.slice(5) })()

export function Stepper() {
  const s = useSession()
  if (s.step === 'welcome') return null
  const steps = stepsOf(s).filter((st) => st !== 'welcome')
  const cur = steps.indexOf(s.step)
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((st, i) => (
        <span key={st} style={{ display: 'contents' }}>
          {i > 0 && <span className={`connector${i <= cur ? ' done' : ''}`} />}
          <button type="button" className={`step${i < cur ? ' done' : ''}${i === cur ? ' current' : ''}`}
            onClick={() => s.runStatus !== 'running' && s.goTo(st)} // nav reads the gates (goTo refuses locked steps); ALL nav locks while an analysis runs (design rule)
            aria-current={i === cur ? 'step' : undefined}>
            <span className="dot">{i < cur ? '✓' : i + 1}</span>{label(st)}
          </button>
        </span>
      ))}
    </nav>
  )
}
