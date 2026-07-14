// Wiring sweep core (graduated from scripts/wiring-sweep.mts into a permanent gate - T13/R16,
// board-clearing slice; the script remains as a thin CLI wrapper for ad-hoc triage output).
//
//   Sweep B - PROMISE check (static): every table a registry declares must be referenced by that
//     test's own results builder (the H2/EFA class: computed or promised, never rendered).
//   Sweep A - OPTION check (emitter diff): flipping any non-display option must change the emitted
//     analysis.R for at least one alternative value (the H1 class: controls wired to nothing).
//
// Both sweeps are pure TS (no WebR, no native R), so wiringSweep.test.ts runs them inside test:fast.
// The known false positives live in ALLOWLIST below, one entry per (testId, optionId) pair with a
// documented reason; wiringSweep.test.ts asserts suspects == ALLOWLIST exactly, in both directions,
// and that every entry belongs to one of the four documented classes.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPECS } from '../../registry/catalog'
import type { OptionSpec } from '../../registry/types'
import type { TestSetup } from '../../../state/session'
import { parseCsv } from '../../data/parseCsv'
import { emitRScript } from './emit'
import { REPS, type Rep } from './reps'

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const FIXTURES = join(ROOT, 'tests/e2e/fixtures')

// ── Sweep B: registry-declared tables vs builder references ────────────────
// Static source analysis of src/lib/results: resolve each test's builder function from builders.ts's
// mapping, then look for one of the three reference idioms (whole-array use, positional index, table id
// via specTable/find) in the builder source + its local ./ imports. Returns human-readable findings;
// [] = every declared table is reachable.
export const sweepB = (): string[] => {
  const findings: string[] = []
  const buildersSrc = readFileSync(join(ROOT, 'src/lib/results/builders.ts'), 'utf8')
  const fnOf: Record<string, string> = {}
  for (const m of buildersSrc.matchAll(/'([a-z0-9-]+)':\s*\(spec, result\)\s*=>\s*(\w+)\(/g)) fnOf[m[1]] = m[2]
  for (const [id, spec] of Object.entries(SPECS)) {
    const fn = fnOf[id]
    if (!fn) {
      findings.push(`${id}: no builder mapping found in builders.ts`)
      continue
    }
    const file = join(ROOT, `src/lib/results/${fn}.ts`)
    if (!existsSync(file)) {
      findings.push(`${id}: builder file ${fn}.ts not found`)
      continue
    }
    let src = readFileSync(file, 'utf8')
    for (const im of src.matchAll(/from '\.\/(\w+)'/g)) {
      const dep = join(ROOT, `src/lib/results/${im[1]}.ts`)
      if (existsSync(dep)) src += readFileSync(dep, 'utf8')
    }
    const wholeArray = /spec\.tables\.(map|filter|slice|flatMap)|\.\.\.spec\.tables|tables:\s*spec\.tables/.test(src)
    const idxUsed = new Set([...src.matchAll(/spec\.tables\[(\d+)\]/g)].map((m) => Number(m[1])))
    const idsUsed = new Set([...src.matchAll(/specTable\(\s*spec\s*,\s*['"]([a-z0-9-]+)['"]/g)].map((m) => m[1]))
    for (const extra of src.matchAll(/tables\.find\([^)]*['"]([a-z0-9-]+)['"]/g)) idsUsed.add(extra[1])
    // local wrappers around spec.tables.find(t => t.id === id): treat wrapper('id') calls as id refs
    if (/=\s*\(id: string\)\s*=>\s*spec\.tables\.find/.test(src)) {
      for (const w of src.matchAll(/tableById\(\s*['"]([a-z0-9-]+)['"]/g)) idsUsed.add(w[1])
    }
    const declared = (spec.tables ?? []).map((t, k) => ({ id: t.id, k }))
    const missing = wholeArray ? [] : declared.filter((d) => !idxUsed.has(d.k) && !idsUsed.has(d.id))
    if (missing.length) findings.push(`${id} (${fn}.ts): unreachable -> ${missing.map((d) => d.id).join(', ')}`)
  }
  return findings
}

// ── Supplemental setups: the tests without a runs-in-r REP ──────────────────
// Hand-transcribed from the docs harness scenarios (tests/docs/document-tests.spec.ts CASES):
// roles = the drags [[column, roleId], ...] appended in order; fixtures are the docs-v2 worlds
// (already present under tests/e2e/fixtures). Options = registry defaults (number/toggle -> o.default,
// select -> o.value, proportions -> o.value), plus the docs `set:` overrides where the scenario needs
// them (one-sample-t mu0=50, rdd cutoff=60). columnLevels mirror the docs dataConfig level actions.
type OptionValues = TestSetup['options']
const defaultOptions = (id: string): OptionValues => {
  const out: OptionValues = {}
  for (const o of SPECS[id]?.options ?? []) {
    if (o.kind === 'number' || o.kind === 'toggle') out[o.id] = o.default as number | boolean
    else if (o.kind === 'select' || o.kind === 'proportions') out[o.id] = o.value
    // display / level-select / arima-order: leave unset (data-bound or honest display)
  }
  return out
}
const sup = (
  id: string,
  fixture: string,
  roles: Record<string, string[]>,
  overrides: OptionValues = {},
  columnLevels?: Record<string, string>,
): Rep => ({
  id,
  fixture,
  setup: { roles, options: { ...defaultOptions(id), ...overrides }, props: {}, blocked: null },
  columnLevels,
})
export const SUPPLEMENTAL: Rep[] = [
  sup('frequencies-crosstabs', 'campus-study.csv', { variables: ['teaching_method'] }),
  sup('one-sample-t-test', 'campus-study.csv', { outcome: ['pretest_score'] }, { mu0: 50 }), // docs: 50-point national baseline
  sup('paired-t-test', 'sleep-caffeine.csv', { conditionA: ['sleep_baseline'], conditionB: ['sleep_high'] }),
  sup('wilcoxon-signed-rank', 'sleep-caffeine.csv', { conditionA: ['rt_baseline'], conditionB: ['rt_high'] }),
  sup('repeated-measures-anova', 'sleep-caffeine.csv',
    { subject: ['participant_id'], measures: ['sleep_baseline', 'sleep_low', 'sleep_high'] }, {}, { participant_id: 'nominal' }),
  sup('mixed-anova', 'sleep-caffeine.csv',
    { subject: ['participant_id'], between: ['tolerance_group'], measures: ['sleep_baseline', 'sleep_low', 'sleep_high'] }, {}, { participant_id: 'nominal' }),
  sup('nested-anova', 'campus-study.csv', { outcome: ['exam_score'], factor: ['school'], nested: ['classroom'] }),
  sup('welch-anova', 'campus-study.csv', { outcome: ['exam_score'], factor: ['teaching_method'] }),
  sup('ancova', 'campus-study.csv', { outcome: ['exam_score'], factor: ['teaching_method'], covariates: ['pretest_score'] }),
  sup('manova', 'campus-study.csv', { outcomes: ['exam_score', 'retention_score'], factors: ['teaching_method'] }),
  sup('mancova', 'campus-study.csv', { outcomes: ['exam_score', 'retention_score'], factors: ['teaching_method'], covariates: ['pretest_score'] }),
  sup('kruskal-wallis', 'campus-study.csv', { outcome: ['absences'], group: ['teaching_method'] }),
  sup('friedman', 'sleep-caffeine.csv',
    { subject: ['participant_id'], measures: ['rt_baseline', 'rt_low', 'rt_high'] }, {}, { participant_id: 'nominal' }),
  sup('spearman', 'campus-study.csv', { variableA: ['motivation_1'], variableB: ['exam_score'] }, {}, { motivation_1: 'ordinal' }),
  sup('kendalls-tau', 'campus-study.csv', { variableA: ['motivation_1'], variableB: ['motivation_2'] }, {}, { motivation_1: 'ordinal', motivation_2: 'ordinal' }),
  sup('chi-square-goodness-of-fit', 'campus-study.csv', { variable: ['teaching_method'] }), // expectedProps default 'equal'
  sup('fishers-exact', 'campus-study.csv', { rowVar: ['gender'], colVar: ['passed_course'] }),
  sup('multiple-linear-regression', 'campus-study.csv',
    { outcome: ['exam_score'], predictors: ['pretest_score', 'study_hours_per_week', 'teaching_method'] }),
  sup('stationarity-tests', 'macro-quarterly.csv', { time: ['quarter'], series: ['gdp_growth'] }),
  sup('granger-causality', 'macro-quarterly.csv', { time: ['quarter'], seriesX: ['gdp_growth'], seriesY: ['unemployment'] }),
  sup('var', 'macro-quarterly.csv', { time: ['quarter'], series: ['gdp_growth', 'inflation', 'unemployment'] }),
  sup('random-effects', 'province-panel.csv',
    { entity: ['province'], time: ['year'], outcome: ['growth'], regressors: ['investment', 'education_spend', 'urbanization'] }, {}, { year: 'ordinal' }),
  sup('hausman-test', 'province-panel.csv',
    { entity: ['province'], time: ['year'], outcome: ['growth'], regressors: ['investment', 'education_spend', 'urbanization'] }, {}, { year: 'ordinal' }),
  sup('did', 'minwage-employment.csv',
    { outcome: ['employment'], treatment: ['treated'], period: ['post'], entity: ['state'], time: ['year'] }, {},
    { year: 'ordinal', treated: 'nominal', post: 'nominal' }),
  sup('rdd', 'scholarship.csv', { outcome: ['later_gpa'], running: ['entrance_score'] }, { cutoff: 60 }), // docs: entrance-score cutoff 60
  sup('propensity-score-matching', 'job-training.csv',
    { outcome: ['post_earnings'], treatment: ['enrolled'], covariates: ['age', 'education_years', 'prior_earnings'] }, {}, { enrolled: 'nominal' }),
]

/** every setup the sweep runs over: the native-R gate's REPS + the supplemental transcriptions */
export const ALL_SETUPS: Rep[] = [...REPS, ...SUPPLEMENTAL]

// ── Sweep A: option flips must change the emitted analysis.R ───────────────
export type SuspectPair = { testId: string; optionId: string }
export const pairKey = (p: SuspectPair): string => `${p.testId}::${p.optionId}`

const altsFor = (o: OptionSpec, current: unknown): (string | number | boolean)[] => {
  switch (o.kind) {
    case 'toggle': return [!(current ?? o.default ?? false)]
    case 'select': return (o.choices ?? []).filter((c) => c !== String(current ?? o.value))
    case 'number': {
      const cur = Number(current ?? o.default ?? 0)
      return [cur === 0.05 ? 0.01 : cur === 0 ? 1 : cur * 2]
    }
    default: return [] // display / level-select / proportions / arima-order: data-bound or honest display
  }
}

export type SweepAResult = {
  /** (testId, optionId) pairs where NO alternative value changes the emitted script (deduped) */
  suspects: SuspectPair[]
  /** setups whose baseline emit threw (a broken setup, not a wiring verdict) */
  failures: string[]
  /** test ids exercised by at least one setup */
  covered: Set<string>
}

export const sweepA = (reps: Rep[] = ALL_SETUPS): SweepAResult => {
  const suspects: SuspectPair[] = []
  const seen = new Set<string>()
  const failures: string[] = []
  const covered = new Set<string>()
  const addSuspect = (testId: string, optionId: string) => {
    const key = pairKey({ testId, optionId })
    if (seen.has(key)) return
    seen.add(key)
    suspects.push({ testId, optionId })
  }
  for (const rep of reps) {
    covered.add(rep.id)
    const spec = SPECS[rep.id]
    if (!spec) {
      failures.push(`${rep.id}: unknown test id`)
      continue
    }
    const ds = parseCsv(readFileSync(join(FIXTURES, rep.fixture), 'utf8'))
    const emit = (options: OptionValues) =>
      emitRScript([rep.id], { [rep.id]: { ...rep.setup, options } }, SPECS, ds, rep.columnLevels ?? {})
    let baseline: string
    try {
      baseline = emit(rep.setup.options)
    } catch (e) {
      failures.push(`${rep.id}: baseline emit failed: ${String(e).slice(0, 120)}`)
      continue
    }
    for (const o of spec.options ?? []) {
      const alts = altsFor(o, rep.setup.options[o.id])
      if (!alts.length) {
        // interactive kinds always yield an alternative except a single-choice select - that is an
        // unflippable control (the 'single-choice' allowlist class); data-bound kinds are skipped.
        if (o.kind === 'select') addSuspect(rep.id, o.id)
        continue
      }
      let anyChange = false
      let anyError = false
      for (const v of alts) {
        try {
          if (emit({ ...rep.setup.options, [o.id]: v }) !== baseline) {
            anyChange = true
            break
          }
        } catch {
          anyError = true // the option at least reaches validation code - not an unwired control
        }
      }
      if (!anyChange && !anyError) addSuspect(rep.id, o.id)
    }
  }
  return { suspects, failures, covered }
}

// ── The false-positive ledger ───────────────────────────────────────────────
// Owner-triaged 2026-07-13/14 (wiring-inspection verdicts, spec 2026-07-14-board-clearing-slice-design.md).
// Four documented classes ONLY - wiringSweep.test.ts rejects any entry outside them, and rejects entries
// that are no longer real suspects, so a genuine wiring bug cannot be parked here silently.
export type AllowlistReason =
  | 'runner-wired' // alpha: the APP runner consumes the significance level (verdict sentences, CI labels); the emitted script is legitimately level-free (R prints exact p-values)
  | 'display-wired' // the option flips how the card PRESENTS already-computed quantities; the script always prints both forms (owner-ruled by design)
  | 'retention-gated' // the count only takes effect when retention = fixed-n; baselines run retention = parallel where it is legitimately ignored
  | 'single-choice' // a select with exactly one choice - structurally no alternative exists to flip to
export type AllowlistEntry = SuspectPair & { reason: AllowlistReason }

const alphaEntry = (testId: string): AllowlistEntry => ({ testId, optionId: 'alpha', reason: 'runner-wired' })

export const ALLOWLIST: AllowlistEntry[] = [
  // alpha, keyed per (testId, 'alpha'): app-side runner-wired, script legitimately level-free.
  alphaEntry('simple-linear-regression'),
  alphaEntry('multiple-linear-regression'),
  alphaEntry('logistic-regression'),
  alphaEntry('poisson-negative-binomial'),
  alphaEntry('one-sample-t-test'),
  alphaEntry('independent-t-test'),
  alphaEntry('paired-t-test'),
  alphaEntry('one-way-anova'),
  alphaEntry('factorial-anova'),
  alphaEntry('repeated-measures-anova'),
  alphaEntry('mixed-anova'),
  alphaEntry('nested-anova'),
  alphaEntry('welch-anova'),
  alphaEntry('ancova'),
  alphaEntry('manova'),
  alphaEntry('mancova'),
  alphaEntry('mann-whitney-u'),
  alphaEntry('wilcoxon-signed-rank'),
  alphaEntry('kruskal-wallis'),
  alphaEntry('friedman'),
  alphaEntry('pearson'),
  alphaEntry('spearman'),
  alphaEntry('kendalls-tau'),
  alphaEntry('chi-square-goodness-of-fit'),
  alphaEntry('chi-square-independence'),
  alphaEntry('fishers-exact'),
  alphaEntry('fixed-effects'),
  alphaEntry('random-effects'),
  alphaEntry('hausman-test'),
  alphaEntry('iv-2sls'),
  alphaEntry('did'),
  alphaEntry('stationarity-tests'),
  alphaEntry('granger-causality'),
  // display-wired by design: the card re-presents quantities the script already prints in both forms
  // (logistic always prints B and OR columns; MLR always prints B and beta columns).
  { testId: 'logistic-regression', optionId: 'reportOR', reason: 'display-wired' },
  { testId: 'multiple-linear-regression', optionId: 'standardize', reason: 'display-wired' },
  // gated behind retention mode: only read when retention = fixed-n (baselines use parallel analysis).
  { testId: 'efa', optionId: 'nFactors', reason: 'retention-gated' },
  { testId: 'pca', optionId: 'nComponents', reason: 'retention-gated' },
  // single-choice selects: 'auto' is the only choice drawn on the card - no alternative exists.
  { testId: 'stationarity-tests', optionId: 'lags', reason: 'single-choice' },
  { testId: 'var', optionId: 'lagOrder', reason: 'single-choice' },
]
