import { useSession, gateOk, stepsOf, workingDataset } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { DragSlots } from '../DragSlots'
import { categoriesOf, propsArray, propsSumOk } from '../../lib/data/props'

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
        ) : o.kind === 'level-select' ? (
          (() => {
            const col = setup.roles[o.fromRole!]?.[0]
            const cats = col ? categoriesOf(workingDataset(s), col) : []
            return (
              <label key={o.id} className="pill">
                {o.label}{' '}
                <select aria-label={o.label} value={String(setup.options[o.id] ?? '')} disabled={running || !col}
                  onChange={(e) => s.setOption(testId, o.id, e.target.value)}
                  style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
                  {cats.length ? cats.map((c) => <option key={c} value={c}>{c}</option>) : <option value="">—</option>}
                </select>
              </label>
            )
          })()
        ) : o.kind === 'select' || o.kind === 'proportions' ? (
          <label key={o.id} className="pill">
            {o.label}{' '}
            <select aria-label={o.label} value={String(setup.options[o.id] ?? o.value)} disabled={running}
              onChange={(e) => s.setOption(testId, o.id, e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {(o.kind === 'proportions' ? ['equal', 'custom'] : o.choices!).map((c) => <option key={c} value={c}>{c}</option>)}
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
      {spec.options.filter((o) => o.kind === 'proportions' && setup.options[o.id] === 'custom').map((o) => {
        const col = setup.roles[spec.constraints.roles[0].roleId][0]
        if (!col) return <p key={o.id} className="hint" style={{ marginTop: 6 }}>assign a column to {spec.roles[0].label} to set custom proportions</p>
        const cats = categoriesOf(workingDataset(s), col)
        const vals = propsArray(cats, setup.props)
        const sum = vals.reduce((a, b) => a + b, 0)
        return (
          <div key={o.id} style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {cats.map((c, i) => (
              <label key={c} className="pill">
                {c}{' '}
                <input type="number" step={0.01} min={0} value={Number(vals[i].toFixed(4))} disabled={running}
                  aria-label={`proportion: ${c}`} onChange={(e) => s.setProp(testId, c, Number(e.target.value))}
                  style={{ width: '5em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
              </label>
            ))}
            <span className="hint">{propsSumOk(vals) ? `Σ = ${sum.toFixed(2)}` : `Σ = ${sum.toFixed(2)} — proportions must sum to 1`}</span>
          </div>
        )
      })}
      {spec.options.filter((o) => o.hint).map((o) => (
        <p key={o.id} className="hint" style={{ marginTop: 6 }}>{o.hint}</p>
      ))}
      <div className="btn-row">
        <span className="hint">{(() => { // name the first failing gate — a generic hint can't say whether the blocker is here or on a later test
          if (running) return ''
          const firstOpen = steps.find((st) => st.startsWith('test:') && !gateOk(s, st))
          if (!firstOpen) return 'first run loads the R engine'
          if (firstOpen === `test:${testId}`) {
            const rolesOk = spec.constraints.roles.every((r) => setup.roles[r.roleId].length >= r.arity.min)
            if (!rolesOk) return 'fill every required slot here to enable Run · first run loads the R engine'
            if (spec.options.some((o) => o.kind === 'level-select')) return 'pick an event category to enable Run'
            if (spec.options.some((o) => o.kind === 'proportions')) return 'custom proportions must sum to 1 to enable Run'
            return 'exposure values must be strictly positive (its log is the offset)'
          }
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
