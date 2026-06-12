export interface ColumnDef { key: string; label: string; sub?: string; suffix?: string } // sub renders as <sub> — e.g. { label: 'M', sub: 'diff' } → M<sub>diff</sub> · suffix renders after the sub, e.g. M<sub>diff</sub> (adj.)
export interface TableSpec { id: string; title: string; columns: ColumnDef[]; captionStyle?: 'bare'; domId?: string } // 'bare' renders "Table." (Summary, Distribution); default = numbered "Table N." · domId: DOM/capture id when the card-faithful id would collide on a combined results page (zip names keep id)
export interface RoleSpec { id: string; label: string; levels: string; arity: string; hint?: string } // hint: drawn helper line under the slot (design §3 — Frequencies)
export interface OptionSpec { id: string; label: string; value: string; kind: 'display' | 'toggle' | 'number' | 'select' | 'proportions'; default?: boolean | number; choices?: string[]; hint?: string } // default only for interactive kinds; choices: select kind: choices verbatim from the card; value = the drawn default · hint: the card's set-it warning (design §3 — μ₀) · proportions: select equal/custom + per-category number inputs (GoF, design R1)
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { min: number; max: number }; categories?: { exact?: number; min?: number } } // max: Infinity allowed
export type MinRule =
  | { kind: 'rows-per-group'; n: number }   // t-test, Mann-Whitney
  | { kind: 'complete-pairs'; n: number }   // Paired t, Wilcoxon
  | { kind: 'values'; n: number }           // One-sample, Distribution
  | { kind: 'used-columns'; n: number }     // Summary, Frequencies (≥1 compatible Used column)
  | { kind: 'complete-wide-rows'; n: number } // RM/Mixed/Friedman: ≥n rows complete across ≥2 candidate measure columns
export interface TestConstraints { roles: RoleConstraint[]; minRule: MinRule }
export interface FigureSpec { caption: string; type: string; file?: string; optional?: true } // file: zip slug when the card's bundle name doesn't equal the type (ANOVA cards: 'means-plot' vs type 'means plot with 95% CI error bars')
export interface TestSpec {
  id: string; name: string; question: string
  roles: RoleSpec[]; options: OptionSpec[]; tables: TableSpec[]
  assumptionNote?: string                    // t-test only (locked); new entries use tableNote
  tableNote?: { kind: 'assume' | 'plain'; text: string } // absent = no note (Wilcoxon)
  figure?: FigureSpec                        // t-test only (locked)
  figures?: FigureSpec[]                     // new entries
  howToRead: string; apaTemplate: string; rMap: string; bundleFiles: string[]
  constraints: TestConstraints
}
export const figuresOf = (s: TestSpec): FigureSpec[] => s.figures ?? (s.figure ? [s.figure] : [])
