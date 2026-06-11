import { useSession, gateOk, stepsOf } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { DragSlots } from '../DragSlots'

export function TestConfigScreen({ testId }: { testId: string }) {
  const s = useSession()
  const spec = SPECS[testId]
  const setup = s.setups[testId]
  if (!spec || !setup) return null
  const idx = s.selection.indexOf(testId) + 1
  const allReady = stepsOf(s).filter((st) => st.startsWith('test:')).every((st) => gateOk(s, st))
  const running = s.runStatus === 'running'
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
        <span className="hint">{running ? '' : 'enabled when every selected test is fully configured · first run loads the R engine'}</span>
        <button className="btn" disabled={!allReady || running} onClick={() => { void s.runAll() }}>
          {running ? (s.runPhase ?? 'Running…') : 'Run analysis'}
        </button>
      </div>
    </section>
  )
}
