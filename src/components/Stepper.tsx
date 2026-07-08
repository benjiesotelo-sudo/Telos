import { useLayoutEffect, useRef, useState } from 'react'
import { useSession } from '../state/session'
import { railModel, type RailModel } from '../state/stages'
import { HintBar } from './HintBar'
import { dismissHint, hintSeen as wasHintSeen } from './hintStorage'
import { RAIL_HINT } from '../content/copy'

export function StepperUI({ model, onGo }: { model: RailModel; onGo: (step: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const stagesRef = useRef<HTMLDivElement>(null)
  const [fillPx, setFillPx] = useState<number | null>(null)
  // The model's fraction lives in STAGE space (stage i of the N-1 segments). The nodes, however, sit
  // at flex space-between positions that shift with label widths and the Configure sub-dot band - a
  // raw percentage of the track paints past (or short of) the current node. Map stage-space to pixels
  // piecewise across the MEASURED node centers, so the thread always ends exactly on the current node
  // and sub-dot progress interpolates between the Configure and Results nodes. Falls back to the
  // percentage before first measure (and in static renders, where effects never run).
  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current; const row = stagesRef.current
      if (!track || !row) return
      const nodes = row.querySelectorAll('.node')
      if (nodes.length < 2) { setFillPx(null); return }
      const t = track.getBoundingClientRect()
      const centers = Array.from(nodes, (n) => { const b = n.getBoundingClientRect(); return b.x + b.width / 2 - t.x })
      const seg = model.fraction * (centers.length - 1)
      const i = Math.min(Math.max(Math.floor(seg), 0), centers.length - 2)
      const px = centers[i] + (seg - i) * (centers[i + 1] - centers[i])
      setFillPx(Math.max(0, Math.min(px, t.width)))
    }
    measure()
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => {}) // a font swap shifts label widths → node centers
    return () => window.removeEventListener('resize', measure)
  }, [model])
  return (
    <nav className="rail" aria-label="Progress">
      <div className="rail-track" ref={trackRef}>
        <span className="rail-fill" style={{ width: fillPx == null ? `${Math.round(model.fraction * 100)}%` : `${fillPx}px` }} />
      </div>
      <div className="stages" ref={stagesRef}>
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
                    aria-label={d.aria} disabled={!d.enabled}
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
  const [hintSeen, setHintSeen] = useState(() => wasHintSeen('telos-hint-rail'))
  const dismiss = () => { dismissHint('telos-hint-rail'); setHintSeen(true) }
  if (s.step === 'welcome') return null
  // No wrapper div: .rail is position:sticky, and a same-height wrapper leaves it no room to stick.
  // (The old scroll-into-view served the horizontally-scrolling stepper; the rail never overflows.)
  return <>
    <StepperUI model={railModel(s)} onGo={(step) => { dismiss(); s.goTo(step as never) }} />
    {!hintSeen && <HintBar text={RAIL_HINT} onDismiss={dismiss} />}
  </>
}
