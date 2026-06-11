import { useSession, gateOk, stepsOf } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { DragSlots } from '../DragSlots'

export function TestConfigScreen({ testId }: { testId: string }) {
  const s = useSession()
  const spec = SPECS[testId]
  const setup = s.setups[testId]
  if (!spec || !setup) return null
  const idx = s.selection.indexOf(testId) + 1
  const eq = spec.options.find((o) => o.id === 'equalVariance')!
  const fixedOptions = spec.options.filter((o) => o.id !== 'equalVariance') // α/tails/CI encoded; controls deferred (recorded scope)
  const allReady = stepsOf(s).filter((st) => st.startsWith('test:')).every((st) => gateOk(s, st))
  const running = s.runStatus === 'running'
  return (
    <section>
      <div className="eyebrow">{idx} · {spec.name}</div>
      <h1 className="title">Drag columns into roles</h1>
      {setup.blocked && <div className="error-box" role="alert">Blocked: {setup.blocked}</div>}
      <DragSlots testId={testId} spec={spec} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {fixedOptions.map((o) => <span key={o.id} className="pill">{o.label} {o.value}</span>)}
        <label className={`pill${setup.equalVariance ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={setup.equalVariance} disabled={running}
            onChange={(e) => s.setEqualVariance(testId, e.target.checked)} style={{ marginRight: 6 }} />
          {eq.label} ({eq.value})
        </label>
      </div>
      <div className="btn-row">
        <span className="hint">{running ? '' : 'enabled when every selected test is fully configured · first run loads the R engine'}</span>
        <button className="btn" disabled={!allReady || running} onClick={() => { void s.runAll() }}>
          {running ? (s.runPhase ?? 'Running…') : 'Run analysis'}
        </button>
      </div>
    </section>
  )
}
