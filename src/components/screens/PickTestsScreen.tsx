import { useSession, workingDataset } from '../../state/session'
import { CATALOG, SPECS } from '../../lib/registry/catalog'
import { testEligibility } from '../../lib/eligibility/eligibility'

export function PickTestsScreen() {
  const s = useSession()
  const working = workingDataset(s)
  const verdicts = new Map(CATALOG.map((c) => [c.id, testEligibility(c, SPECS[c.id] ?? null, s.columns, working)]))
  const families = [...new Set(CATALOG.map((c) => c.family))]
  const allGreyed = CATALOG.every((c) => !verdicts.get(c.id)!.ok)
  return (
    <section>
      <div className="eyebrow">Step 5</div>
      <h1 className="title">Pick a test</h1>
      <p className="hint">Select one or more tests below. Tests that don't fit your data are greyed out — hover to see why. Each test you pick gets its own configuration step.</p>
      {allGreyed && (
        <div className="error-box" role="alert">
          No test fits the current data: every option is greyed out. Check the uploaded file (step 2) or the column levels and Use toggles (step 4).
        </div>
      )}
      <div className="card">
        {families.map((fam, fi) => (
          <div key={fam}>
            <div style={{ fontWeight: 700, marginTop: fi ? 12 : 0 }}>{fi + 1} · {fam}</div>
            {[...new Set(CATALOG.filter((c) => c.family === fam).map((c) => c.subfamily))].map((sub) => (
              <div key={sub ?? 'none'} style={{ marginLeft: 16 }}>
                {sub && <div className="eyebrow" style={{ marginTop: 6 }}>{sub}</div>}
                {CATALOG.filter((c) => c.family === fam && c.subfamily === sub).map((c) => {
                  const v = verdicts.get(c.id)!
                  return (
                    <div key={c.id} style={{ margin: '4px 0', ...(v.ok ? {} : { opacity: 0.5 }) }}>
                      <label>
                        <input type="checkbox" disabled={!v.ok} checked={s.selection.includes(c.id)}
                          onChange={() => s.toggleSelection(c.id)} style={{ marginRight: 8 }} />
                        {c.name}
                      </label>
                      {c.note && <span className="hint"> {c.note}</span>}
                      {!v.ok && <span className="hint"> — {v.reason}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
        <p className="hint" style={{ marginBottom: 0 }}>7 · Assumption diagnostics — inline checks under each test (no standalone cards)</p>
      </div>
      <div className="btn-row">
        <span className="hint">→ the stepper grows one step per selected test</span>
        <button className="btn" disabled={!s.selection.length} onClick={() => s.goTo(`test:${s.selection[0]}`)}>Confirm selection</button>
      </div>
    </section>
  )
}
