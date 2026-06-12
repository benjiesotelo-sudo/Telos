import { useSession, gateOk, stepsOf } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { DragSlots } from '../DragSlots'

export function TestConfigScreen({ testId }: { testId: string }) {
  const s = useSession()
  const spec = SPECS[testId]
  const setup = s.setups[testId]
  if (!spec || !setup) return null
  const idx = s.selection.indexOf(testId) + 1
  const steps = stepsOf(s)
  const allReady = steps.filter((st) => st.startsWith('test:')).every((st) => gateOk(s, st))
  const running = s.runStatus === 'running'
  // The stepper is the only other path between test configs — a visible Next keeps first-time users moving.
  const next = steps[steps.indexOf(`test:${testId}`) + 1]
  const nextSpec = next?.startsWith('test:') ? SPECS[next.slice(5)] : null
  return (
    <section>
      <div className="eyebrow">{idx} · {spec.name}</div>
      <h1 className="title">Drag columns into roles</h1>
      {setup.blocked && <div className="error-box" role="alert">Blocked: {setup.blocked}</div>}
      <DragSlots testId={testId} spec={spec} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {spec.options.map((o) => o.kind === 'display' ? (
          <span key={o.id} className="pill">{o.label} {o.value}</span>
        ) : o.kind === 'toggle' ? (
          <label key={o.id} className={`pill${setup.options[o.id] ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!setup.options[o.id]} disabled={running}
              onChange={(e) => s.setOption(testId, o.id, e.target.checked)} style={{ marginRight: 6 }} />
            {o.label} ({o.value})
          </label>
        ) : o.kind === 'select' ? (
          <label key={o.id} className="pill">
            {o.label}{' '}
            <select aria-label={o.label} value={String(setup.options[o.id] ?? o.value)} disabled={running}
              onChange={(e) => s.setOption(testId, o.id, e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {o.choices!.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : (
          <label key={o.id} className="pill">
            {o.label}{' '}
            <input type="number" value={Number(setup.options[o.id] ?? 0)} disabled={running} aria-label={o.label}
              onChange={(e) => s.setOption(testId, o.id, Number(e.target.value))}
              style={{ width: '5em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
          </label>
        ))}
      </div>
      {spec.options.filter((o) => o.hint).map((o) => (
        <p key={o.id} className="hint" style={{ marginTop: 6 }}>{o.hint}</p>
      ))}
      <div className="btn-row">
        <span className="hint">{(() => { // name the first failing gate — a generic hint can't say whether the blocker is here or on a later test
          if (running) return ''
          const firstOpen = steps.find((st) => st.startsWith('test:') && !gateOk(s, st))
          if (!firstOpen) return 'first run loads the R engine'
          if (firstOpen === `test:${testId}`) return 'fill every required slot here to enable Run · first run loads the R engine'
          return `finish configuring ${SPECS[firstOpen.slice(5)]?.name} to enable Run`
        })()}</span>
        {nextSpec && (
          <button className="btn ghost" disabled={!gateOk(s, `test:${testId}`) || running} onClick={() => s.goTo(next)}>
            Next: {nextSpec.name} →
          </button>
        )}
        <button className="btn" disabled={!allReady || running} onClick={() => { void s.runAll() }}>
          {running ? (s.runPhase ?? 'Running…') : 'Run analysis'}
        </button>
      </div>
    </section>
  )
}
