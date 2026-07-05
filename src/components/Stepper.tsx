import { useSession } from '../state/session'
import { railModel, type RailModel } from '../state/stages'
import { HintBar, dismissHint } from './HintBar'
import { RAIL_HINT } from '../content/copy'

export function StepperUI({ model, onGo }: { model: RailModel; onGo: (step: string) => void }) {
  return (
    <nav className="rail" aria-label="Progress">
      <div className="rail-track"><span className="rail-fill" style={{ width: `${Math.round(model.fraction * 100)}%` }} /></div>
      <div className="stages">
        {model.stages.map((st, i) => (
          <span key={st.id} className={`stage ${st.state}`}>
            <button type="button" className="stage-btn" disabled={!st.enabled}
              aria-label={st.label}
              aria-current={st.state === 'current' ? 'step' : undefined}
              onClick={() => st.firstStep && onGo(st.firstStep)}>
              <span className="node">{st.state === 'done' ? '✓' : i + 1}</span>
              <span className="lbl">{st.label}</span>
              {st.sublabel && <span className="sublabel">{st.sublabel}</span>}
            </button>
            {st.sub.length > 0 && (
              <span className="subdots">
                {st.sub.map((d) => (
                  <button key={d.step} type="button" className={`subdot ${d.state}`}
                    aria-label={d.label} disabled={!d.enabled}
                    onClick={() => onGo(d.step)} />
                ))}
              </span>
            )}
          </span>
        ))}
      </div>
      <span className="thread-frac">{model.frac}</span>
    </nav>
  )
}

export function Stepper() {
  const s = useSession()
  if (s.step === 'welcome') return null
  // No wrapper div: .rail is position:sticky, and a same-height wrapper leaves it no room to stick.
  // (The old scroll-into-view served the horizontally-scrolling stepper; the rail never overflows.)
  return <>
    <StepperUI model={railModel(s)} onGo={(step) => { dismissHint('telos-hint-rail'); s.goTo(step as never) }} />
    <HintBar text={RAIL_HINT} storageKey="telos-hint-rail" />
  </>
}
