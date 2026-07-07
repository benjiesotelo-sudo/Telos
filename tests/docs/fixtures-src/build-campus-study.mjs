// build-campus-study.mjs - W1: a campus teaching-method experiment (education domain).
// 240 students, 3 schools x 2 classrooms each (nested), 3 teaching methods x 2 genders (crossed).
// Deterministic - no Math.random, byte-identical on every run.
//
// Story: does a Flipped classroom outperform Blended and Lecture on exam score? Gender has NO
// effect on exam score (an honest, deliberate null - see memory ruling on pedagogical honesty).
// pretest_score (entering ability) and study_hours_per_week are real predictors; motivation is a
// 3-item Likert scale; absences is an overdispersed count (right-skewed, a handful of high-absence
// outliers) - the nonparametric/negative-binomial star. passed_course is a logistic outcome of
// exam_score around a pass/fail threshold.
//
// Usage: `node tests/docs/fixtures-src/build-campus-study.mjs` -> writes tests/e2e/fixtures/campus-study.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 240
const r2 = (x) => Math.round(x * 100) / 100
// Deterministic well-mixed hash (MurmurHash3 finalizer) -> [0,1). A simple linear-congruential
// jitter aliases across seeds (phase-shifted copies of the same ramp), which silently corrupts
// cross-variable correlations; this mixes n and s independently so different seeds decorrelate.
function hash01(n, s) {
  let h = (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const jit = (n, s) => hash01(n, s) * 2 - 1 // -1..+1
const unif = (n, s) => hash01(n, s + 10000) // [0,1), independent of jit(n, s)
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const logistic = (x) => 1 / (1 + Math.exp(-x))

const SCHOOLS = ['A', 'A', 'B', 'B', 'C', 'C']
const CLASSROOMS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const METHODS = ['Lecture', 'Blended', 'Flipped']
const METHOD_EFFECT = [0, 5, 10] // medium-to-large effect, Flipped > Blended > Lecture

const rows = [[
  'student_id', 'school', 'classroom', 'teaching_method', 'gender', 'pretest_score',
  'study_hours_per_week', 'motivation_1', 'motivation_2', 'motivation_3', 'exam_score',
  'retention_score', 'passed_course', 'absences', 'weeks_enrolled',
]]

for (let i = 1; i <= N; i++) {
  const block = Math.floor((i - 1) / 40) // 0..5, 40 students per classroom
  const school = SCHOOLS[block]
  const classroom = CLASSROOMS[block]
  const methodIdx = (i - 1) % 3 // interleaved -> crossed with classroom block, not confounded
  const method = METHODS[methodIdx]
  const gender = (i - 1) % 2 === 0 ? 'Male' : 'Female' // interleaved -> crossed with method

  const pretest_score = clamp(50 + jit(i, 1) * 15, 20, 85)
  const motBase = 4 + jit(i, 2) * 2.4
  const motivation_1 = clamp(Math.round(motBase + jit(i, 21) * 1.5), 1, 7)
  const motivation_2 = clamp(Math.round(motBase + jit(i, 22) * 1.5), 1, 7)
  const motivation_3 = clamp(Math.round(motBase + jit(i, 23) * 1.5), 1, 7)
  const motAvg = (motivation_1 + motivation_2 + motivation_3) / 3
  const study_hours_per_week = clamp(5 + 0.4 * motAvg + jit(i, 3) * 4, 1, 20)

  const exam_score = clamp(
    38 + METHOD_EFFECT[methodIdx] + 0.32 * pretest_score + 1.05 * study_hours_per_week + jit(i, 4) * 9,
    5, 100,
  )
  const retention_score = clamp(18 + 0.66 * exam_score + 0.5 * METHOD_EFFECT[methodIdx] + jit(i, 5) * 7, 5, 100)
  const passed_course = logistic((exam_score - 60) / 8) > unif(i, 1) ? 'Yes' : 'No'

  const absBase = 5 + (methodIdx === 0 ? 2 : methodIdx === 2 ? -2 : 0) - 0.25 * motAvg
  const spike = i % 13 === 0 ? 11 : i % 29 === 0 ? 7 : 0 // heavy right tail -> overdispersion
  const absences = Math.max(0, Math.round(absBase + jit(i, 6) * 3 + spike))
  const weeks_enrolled = i % 23 === 0 ? 10 + (i % 3) : 16

  rows.push([
    `S${String(i).padStart(3, '0')}`, school, classroom, method, gender, r2(pretest_score),
    r2(study_hours_per_week), motivation_1, motivation_2, motivation_3, r2(exam_score),
    r2(retention_score), passed_course, absences, weeks_enrolled,
  ])
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'campus-study.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`campus-study.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
