export interface RunModuleProps { phase: string | null; progress: { message: string; elapsedMs?: number; estMs?: number } | null; testsDone: number; testsTotal: number }

/** Narrated run progress (spec R3). Reads the store's runPhase/runProgress channel via props. */
export function RunModule({ phase, progress, testsDone, testsTotal }: RunModuleProps) {
  if (phase === null) return null
  const inTests = phase.startsWith('Running')
  const pct = progress?.estMs && progress.estMs > 0 ? Math.min(99, Math.round(((progress.elapsedMs ?? 0) / progress.estMs) * 100)) : null
  // Figures narration dropped - no real phase exists (production runPhase never contains 'figure';
  // figures are drawn inside each test's R run). Owner-flagged deviation from mockup 1a.
  const phases: [string, 'ok' | 'now' | 'todo'][] = [
    ['Reading your data', 'ok'],
    ['Loading the R engine', inTests ? 'ok' : 'now'],
    [`Running ${testsTotal} test${testsTotal === 1 ? '' : 's'}`, inTests ? 'now' : 'todo'],
  ]
  const glyph = { ok: '✓', now: '●', todo: '○' } as const
  return (
    <div className="run-card">
      <div className="run-top"><span role="status" aria-live="polite">{phase}</span>{pct !== null && <span className="pct">{pct}%</span>}
        {inTests && pct === null && <span className="pct">{testsDone + 1} of {testsTotal}</span>}</div>
      <div className="run-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : pct}>
        <span className={`run-fill${pct === null ? ' indeterminate' : ''}`} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="run-phases">
        {phases.map(([label, state]) => <span key={label} className={state}>{glyph[state]} {label}</span>)}
      </div>
    </div>
  )
}
