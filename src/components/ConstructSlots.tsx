import { useSession } from '../state/session'
import type { Construct } from '../state/session'

/** Numeric measurement-scale levels — the only item columns valid for AVE/CR constructs */
const NUMERIC_LEVELS = new Set(['ordinal', 'interval', 'ratio'])

interface ConstructSlotsUIProps {
  constructs: Construct[]
  numericColumns: string[]
  running: boolean
  onAddConstruct: () => void
  onRemoveConstruct: (index: number) => void
  onSetName: (index: number, name: string) => void
  onToggleItem: (index: number, item: string) => void
}

/** Pure presentational component — testable with renderToStaticMarkup */
export function ConstructSlotsUI({
  constructs, numericColumns, running,
  onAddConstruct, onRemoveConstruct, onSetName, onToggleItem,
}: ConstructSlotsUIProps) {
  const claimed = new Set(constructs.flatMap((c) => c.items))

  return (
    <div>
      {constructs.length === 0 && (
        <p className="hint" role="status" style={{ marginTop: 6 }}>
          Add at least 1 construct to define the measurement model.
        </p>
      )}
      {constructs.map((construct, idx) => {
        const tooFew = construct.items.length < 2
        return (
          <div key={idx} className="card" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                aria-label={`Construct ${idx + 1} name`}
                placeholder="Construct name"
                value={construct.name}
                disabled={running}
                onChange={(e) => onSetName(idx, e.target.value)}
                style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', background: 'transparent', font: 'inherit', color: 'inherit' }}
              />
              <button
                type="button"
                aria-label={`Remove construct ${idx + 1}`}
                disabled={running}
                onClick={() => onRemoveConstruct(idx)}
                style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                ×
              </button>
            </div>
            <div className="eyebrow" style={{ marginTop: 6 }}>Items</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {numericColumns.map((colName) => {
                const checked = construct.items.includes(colName)
                const inOther = !checked && claimed.has(colName)
                return (
                  <label
                    key={colName}
                    className={`pill${checked ? ' on' : ''}${inOther ? ' incompatible' : ''}`}
                    style={{ cursor: running || inOther ? 'not-allowed' : 'pointer' }}
                    title={inOther ? `${colName} is already in another construct` : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={running || inOther}
                      onChange={() => onToggleItem(idx, colName)}
                      style={{ marginRight: 4 }}
                    />
                    {colName}
                  </label>
                )
              })}
            </div>
            {tooFew && (
              <p className="hint" role="alert" style={{ color: 'var(--error-tx)', marginTop: 4 }}>
                Each construct needs at least 2 items.
              </p>
            )}
          </div>
        )
      })}
      <button
        type="button"
        className="btn ghost"
        disabled={running}
        onClick={onAddConstruct}
        style={{ marginTop: 10 }}
      >
        + Add construct
      </button>
    </div>
  )
}

/** Store-connected component — used in production via TestConfigScreen */
export function ConstructSlots({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  if (!setup) return null

  const numericColumns = s.columns
    .filter((c) => c.used && c.level !== null && NUMERIC_LEVELS.has(c.level))
    .map((c) => c.name)

  const constructs = setup.constructs ?? []

  return (
    <ConstructSlotsUI
      constructs={constructs}
      numericColumns={numericColumns}
      running={s.runStatus === 'running'}
      onAddConstruct={() => s.addConstruct(testId)}
      onRemoveConstruct={(i) => s.removeConstruct(testId, constructs[i].id)}
      onSetName={(i, name) => s.setConstructName(testId, constructs[i].id, name)}
      onToggleItem={(i, item) => s.toggleConstructItem(testId, constructs[i].id, item)}
    />
  )
}
