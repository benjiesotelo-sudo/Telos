import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { SPHERICITY_R, type SphericityInfo } from './sphericity'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

const rmSpher = (cols: string[]) => {
  const ds = loadAnovaFixture()
  const env = {
    sid: ds.rows.map((r) => String(r['subject_id'])),
    scores_flat: cols.flatMap((c) => ds.rows.map((r) => r[c] as number)),
    conds: cols, n: ds.rows.length,
  }
  return engine.runJson<SphericityInfo[]>(`
    ${SPHERICITY_R}
    long <- data.frame(sid = factor(rep(sid, length(conds))),
      condition = factor(rep(conds, each = n), levels = conds),
      score = scores_flat)
    m <- suppressWarnings(suppressMessages(afex::aov_ez(id = 'sid', dv = 'score', data = long, within = 'condition')))
    .telos_sphericity(m)`, env)
}

describe('sphericity module (spike known answers)', () => {
  it('3-level RM: Mauchly W/p + GG/HF eps', async () => {
    const rows = await rmSpher(['score_t1', 'score_t2', 'score_t3'])
    expect(rows).toHaveLength(1)
    expect(rows[0].w).toBeCloseTo(0.873515789948938, 6)
    expect(rows[0].p).toBeCloseTo(0.0198085203154266, 6)
    expect(rows[0].ggEps).toBeCloseTo(0.88771772482694, 6)
    expect(rows[0].hfEps).toBeCloseTo(0.913297705282412, 6)
  }, 300_000)
  it('2-level RM: empty (table omitted per the card rule)', async () => {
    expect(await rmSpher(['score_t1', 'score_t2'])).toEqual([])
  }, 300_000)
})
