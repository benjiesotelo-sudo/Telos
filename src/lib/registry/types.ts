export interface ColumnDef { key: string; label: string; sub?: string; suffix?: string } // sub renders as <sub> — e.g. { label: 'M', sub: 'diff' } → M<sub>diff</sub> · suffix renders after the sub, e.g. M<sub>diff</sub> (adj.)
export interface ModelCol { key: string; label: string } // coef table: one per side-by-side model column ((1) / 'Fixed effects' / 'Odds ratio (OR)' …); single-model tests have exactly one
export interface GofRow { key: string; label: string } // coef table: a goodness-of-fit footer row; label is verbatim so consistency tests still match registry ↔ drawn card
// coef tables (regression/econometrics, design 2026-06-16): kind:'coef' → the builder emits stacked rows (term → est, then a muted (SE) row, then a muted [lo,hi] CI row), a rule, then the gof footer rows. Each built row carries a `_kind` field ('coef'|'se'|'ci'|'rule'|'gof'|'span') that ApaTable styles. columns = [{key:'term',label:''}, ...models as columns, ...extraCols]; models/gof drive the builder + consistency test. extraCols = kept per-term columns (e.g. multiple-linear β, VIF). spanCols (Hausman χ²) render as a full-width row.
export interface TableSpec { id: string; title: string; columns: ColumnDef[]; captionStyle?: 'bare'; domId?: string; kind?: 'coef'; models?: ModelCol[]; gof?: GofRow[]; extraCols?: ColumnDef[] } // 'bare' renders "Table." (Summary, Distribution); default = numbered "Table N." · domId: DOM/capture id when the card-faithful id would collide on a combined results page (zip names keep id) · kind:'coef' = modelsummary stacked layout (see above)
export interface RoleSpec { id: string; label: string; levels: string; arity: string; hint?: string } // hint: drawn helper line under the slot (design §3 — Frequencies)
export interface OptionSpec { id: string; label: string; value: string; kind: 'display' | 'toggle' | 'number' | 'select' | 'proportions' | 'level-select' | 'arima-order'; default?: boolean | number; choices?: string[]; hint?: string; fromRole?: string } // default only for interactive kinds; choices: select kind: choices verbatim from the card; value = the drawn default · hint: the card's set-it warning (design §3 — μ₀) · proportions: select equal/custom + per-category number inputs (GoF, design R1) · level-select: choices = categories of the column assigned to fromRole, default = second level alphabetically (logistic event category, B2)
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { min: number; max: number }; categories?: { exact?: number; min?: number }; tag?: 'count'; timeOrder?: true; excludeTag?: 'datetime' } // max: Infinity allowed · tag: column must carry this columnMeta tag (B1 — Poisson count outcome) · timeOrder: time-series Time role — satisfied by a datetime-tagged OR ordinal column (ignores levels) · excludeTag: reject columns carrying this tag (numeric Series roles must not accept the date column)
export type MinRule =
  | { kind: 'rows-per-group'; n: number }   // t-test, Mann-Whitney
  | { kind: 'complete-pairs'; n: number }   // Paired t, Wilcoxon
  | { kind: 'values'; n: number }           // One-sample, Distribution
  | { kind: 'used-columns'; n: number }     // Summary, Frequencies (≥1 compatible Used column)
  | { kind: 'complete-wide-rows'; n: number } // RM/Mixed/Friedman: ≥n rows complete across ≥2 candidate measure columns
  | { kind: 'panel'; n: number }            // FE/RE/Hausman: ≥2 entities, ≥2 periods, ≥n complete (entity,time,outcome,≥1 regressor) rows. Roles order: entity,time,outcome,regressors
export interface TestConstraints { roles: RoleConstraint[]; minRule: MinRule }
export interface FigureSpec { caption: string; type: string; file?: string; optional?: true } // file: zip slug when the card's bundle name doesn't equal the type (ANOVA cards: 'means-plot' vs type 'means plot with 95% CI error bars')
export interface TestSpec {
  id: string; name: string; question: string
  roles: RoleSpec[]; options: OptionSpec[]; tables: TableSpec[]
  assumptionNote?: string                    // t-test only (locked); new entries use tableNote
  tableNote?: { kind: 'assume' | 'plain'; text: string; afterTableId?: string } // absent = no note (Wilcoxon) · afterTableId: render note inline after that table
  figure?: FigureSpec                        // t-test only (locked)
  figures?: FigureSpec[]                     // new entries
  howToRead: string; apaTemplate: string; rMap: string; bundleFiles: string[]
  constraints: TestConstraints
}
export const figuresOf = (s: TestSpec): FigureSpec[] => s.figures ?? (s.figure ? [s.figure] : [])
