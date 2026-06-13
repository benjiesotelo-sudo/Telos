import { useSession, gateOk } from '../../state/session'
import { applyMissingPolicy } from '../../lib/data/missing'
import { compatibleLevels } from '../../lib/data/columnMeta'
import type { Level } from '../../lib/registry/types'
import type { MissingPolicy } from '../../lib/data/missing'

const POLICIES: [MissingPolicy, string][] = [['drop', 'Drop rows'], ['impute', 'Impute'], ['leave', 'Leave as-is']]

export function ConfigureDataScreen() {
  const s = useSession()
  const ready = gateOk(s, 'configure-data')
  const dropped = s.raw ? applyMissingPolicy(s.raw, s.columns, 'drop').droppedCount : 0
  // ui-spec 4c: the fix-type override is for a NUMERIC column mis-parsed as text — not every text column
  const numericAsText = (name: string) => {
    const vals = (s.raw?.rows ?? []).map((r) => r[name]).filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    return vals.length > 0 && vals.filter((v) => Number.isFinite(Number(v.trim()))).length >= vals.length / 2 // DRAFT heuristic — Benjie reviews rendered
  }
  return (
    <section>
      <div className="eyebrow">Step 4</div>
      <h1 className="title">Configure data</h1>

      <div className="card">
        <div className="eyebrow">Missing data</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {POLICIES.map(([v, lbl]) => (
            <button key={v} type="button" className={`pill${s.missingPolicy === v ? ' on' : ''}`} style={{ cursor: 'pointer' }}
              onClick={() => s.setMissingPolicy(v)}>{lbl}</button>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {s.missingPolicy === 'leave' && 'Default — each test analyzes complete cases on its own columns and reports its own N.'}
          {s.missingPolicy === 'drop' && `Rows with a missing value in any Used column are removed — ${dropped} rows dropped.`}
          {s.missingPolicy === 'impute' && 'Mean (interval/ratio) or mode (nominal/ordinal). Caution: imputation understates variance.'}
        </p>
      </div>

      {s.fileInfo && <div className="card mono">{s.fileInfo.rows} rows · {s.fileInfo.cols} columns · {s.fileInfo.encoding}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="cols-table">
          <thead><tr><th>Column</th><th>Detected type</th><th>Measurement level</th><th>Use</th></tr></thead>
          <tbody>
            {s.columns.map((c) => (
              <tr key={c.name} style={c.used ? undefined : { opacity: 0.5 }}>
                <td><input defaultValue={c.name} aria-label={`rename ${c.name}`} style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit', width: '10em' }}
                  onBlur={(e) => { if (e.target.value !== c.name) s.renameColumn(c.name, e.target.value) }} /></td>
                <td className="mono">{c.detected}{c.tags.length ? ` · ${c.tags.join(' · ')}` : ''}
                  {c.detected === 'object' && numericAsText(c.name) && <button type="button" className="pill" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => s.applyFixType(c.name)}>fix type</button>}</td>
                <td>
                  <select aria-label={`level of ${c.name}`} value={c.level ?? ''} disabled={!c.used}
                    onChange={(e) => s.setColumnLevel(c.name, (e.target.value || null) as Level | null)}>
                    <option value="">—</option>{compatibleLevels(c.detected).map((l) => <option key={l}>{l}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" aria-label={`use ${c.name}`} checked={c.used} onChange={(e) => s.setColumnUsed(c.name, e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Derived tags (count · datetime · id) are auto-detected column properties used by test eligibility — not levels you set.</p>

      <div className="btn-row">
        {!ready && <span className="hint">set a level for every used column to continue</span>}
        <button className="btn" disabled={!ready} onClick={() => s.goTo('pick-tests')}>Confirm &amp; pick test</button>
      </div>
    </section>
  )
}
