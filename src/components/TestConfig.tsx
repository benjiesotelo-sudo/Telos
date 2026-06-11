import { useState } from 'react'
import { useSession } from '../state/session'
import { Engine } from '../lib/webr/engine'
import { runIndependentTTest } from '../lib/stats/independentTTest'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'
import type { RoleSpec } from '../lib/registry/types'
let enginePromise: Promise<Engine> | null = null
const getEngine = (onStatus?: (m: string) => void) => (enginePromise ??= (async () => { const e = new Engine(); await e.init(onStatus); return e })())
export function TestConfig() {
  const { dataset, config, setConfig, setStatus, setResult, setError, status } = useSession()
  const [phase, setPhase] = useState<string | null>(null) // boot/run progress — first click downloads the WebR runtime + ggplot2
  if (!dataset) return null
  const run = async () => {
    if (!config.outcome || !config.group) return
    setStatus('running')
    try {
      const engine = await getEngine(setPhase)
      setPhase('Running analysis…')
      setResult(await runIndependentTTest(engine, dataset, config.outcome, config.group, config.equalVariance))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPhase(null) }
  }
  // Role labels + level requirements come from the registry (the inputs card), never hardcoded strings.
  const [outcomeRole, groupRole] = spec.roles
  const sel = (key: 'outcome' | 'group', role: RoleSpec) => (
    <label>{role.label} ({role.levels} · {role.arity}){' '}
      <select value={config[key] ?? ''} onChange={(e) => setConfig({ [key]: e.target.value })}>
        <option value="">—</option>{dataset.columns.map((c) => <option key={c}>{c}</option>)}
      </select></label>
  )
  const eqOpt = spec.options.find((o) => o.id === 'equalVariance')!
  return (
    <section>
      {sel('outcome', outcomeRole)} {sel('group', groupRole)}
      <label>
        <input type="checkbox" checked={config.equalVariance} onChange={(e) => setConfig({ equalVariance: e.target.checked })} />
        {' '}{eqOpt.label} ({eqOpt.value})
      </label>
      <button disabled={!config.outcome || !config.group || status === 'running'} onClick={run}>
        {status === 'running' ? (phase ?? 'Running…') : 'Run analysis'}
      </button>
    </section>
  )
}
