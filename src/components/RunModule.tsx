export interface RunModuleProps { phase: string | null; progress: { message: string; elapsedMs?: number; estMs?: number } | null; testsDone: number; testsTotal: number }

/** Narrated run progress (spec R3). Reads the store's runPhase/runProgress channel via props. */
export function RunModule({ phase, progress, testsDone, testsTotal }: RunModuleProps) {
  if (phase === null) return null
  const inTests = phase.startsWith('Running')
  const pct = progress?.estMs ? Math.min(99, Math.round(((progress.elapsedMs ?? 0) / progress.estMs) * 100)) : null
  const phases: [string, 'ok' | 'now' | 'todo'][] = [
    ['Reading your data', 'ok'],
    ['Loading the R engine', inTests ? 'ok' : 'now'],
    [`Running ${testsTotal} test${testsTotal === 1 ? '' : 's'}`, inTests ? 'now' : 'todo'],
    ['Drawing figures', 'todo'],
  ]
  const glyph = { ok: '✓', now: '●', todo: '○' } as const
  return (
    <div className="run-card" role="status" aria-live="polite">
      <div className="run-top"><span>{phase}</span>{pct !== null && <span className="pct">{pct}%</span>}
        {inTests && pct === null && <span className="pct">{testsDone + 1} of {testsTotal}</span>}</div>
      <div className="run-track">
        <span className={`run-fill${pct === null ? ' indeterminate' : ''}`} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="run-phases">
        {phases.map(([label, state]) => <span key={label} className={state}>{glyph[state]} {label}</span>)}
      </div>
    </div>
  )
}
