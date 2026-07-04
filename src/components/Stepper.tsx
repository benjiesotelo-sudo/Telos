import { useEffect, useRef } from 'react'
import { useSession } from '../state/session'
import { railModel, type RailModel } from '../state/stages'

export function StepperUI({ model, onGo }: { model: RailModel; onGo: (step: string) => void }) {
  return (
    <nav className="rail" aria-label="Progress">
      <div className="rail-track"><span className="rail-fill" style={{ width: `${Math.round(model.fraction * 100)}%` }} /></div>
      <div className="stages">
        {model.stages.map((st, i) => (
          <button key={st.id} type="button" className={`stage ${st.state}`} disabled={!st.enabled}
            aria-label={st.label}
            aria-current={st.state === 'current' ? 'step' : undefined}
            onClick={() => st.firstStep && onGo(st.firstStep)}>
            <span className="node">{st.state === 'done' ? '✓' : i + 1}</span>
            <span className="lbl">{st.label}</span>
            {st.sub.length > 0 && (
              <span className="subdots">
                {st.sub.map((d) => (
                  <span key={d.step} role="button" aria-label={d.label} aria-disabled={!d.enabled}
                    className={`subdot ${d.state}`}
                    onClick={(e) => { e.stopPropagation(); if (d.enabled) onGo(d.step) }} />
                ))}
              </span>
            )}
            {st.sublabel && <span className="sublabel">{st.sublabel}</span>}
          </button>
        ))}
      </div>
      <span className="thread-frac">{model.frac}</span>
    </nav>
  )
}

export function Stepper() {
  const s = useSession()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest' }) }, [s.step])
  if (s.step === 'welcome') return null
  return <div ref={ref}><StepperUI model={railModel(s)} onGo={(step) => s.goTo(step as never)} /></div>
}
