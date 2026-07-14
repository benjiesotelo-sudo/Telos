// Thin CLI wrapper over the wiring-sweep core for ad-hoc triage output.
// The PERMANENT gate is src/lib/export/rScript/wiringSweep.test.ts (runs in test:fast); the sweep
// logic + the owner-triaged false-positive ALLOWLIST live in src/lib/export/rScript/wiringSweep.ts.
// Usage: npx tsx scripts/wiring-sweep.mts
import { SPECS } from '../src/lib/registry/catalog'
import { ALL_SETUPS, ALLOWLIST, pairKey, sweepA, sweepB } from '../src/lib/export/rScript/wiringSweep'

console.log('=== SWEEP B: declared tables unreachable from their builder ===')
const bFindings = sweepB()
for (const f of bFindings) console.log(`[B!] ${f}`)
console.log(`Sweep B suspects: ${bFindings.length}\n`)

console.log('=== SWEEP A: options whose every alternative leaves analysis.R unchanged ===')
const { suspects, failures, covered } = sweepA(ALL_SETUPS)
for (const f of failures) console.log(`[A?] ${f}`)
const allowKeys = new Map(ALLOWLIST.map((e) => [pairKey(e), e.reason]))
let newCount = 0
for (const s of suspects) {
  const reason = allowKeys.get(pairKey(s))
  if (reason) console.log(`[A~] ${s.testId}: option '${s.optionId}' - allowlisted (${reason})`)
  else {
    newCount++
    console.log(`[A!] ${s.testId}: option '${s.optionId}' - NEW SUSPECT, no alternative changes the emitted script`)
  }
}
const stale = ALLOWLIST.map(pairKey).filter((k) => !suspects.some((s) => pairKey(s) === k))
for (const k of stale) console.log(`[A-] stale allowlist entry (now wired?): ${k}`)
console.log(`Sweep A: ${suspects.length} suspects (${newCount} NEW, ${suspects.length - newCount} allowlisted), ${stale.length} stale entries`)
console.log(`Coverage: ${covered.size}/${Object.keys(SPECS).length} tests with REP or supplemental setups`)
const uncovered = Object.keys(SPECS).filter((id) => !covered.has(id))
if (uncovered.length) console.log(`Uncovered (${uncovered.length}): ${uncovered.join(', ')}`)
process.exitCode = bFindings.length || newCount || stale.length || failures.length || uncovered.length ? 1 : 0
