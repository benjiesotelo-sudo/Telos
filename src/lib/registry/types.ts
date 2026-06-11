export interface ColumnDef { key: string; label: string; sub?: string } // sub renders as <sub> — e.g. { label: 'M', sub: 'diff' } → M<sub>diff</sub>
export interface TableSpec { id: string; title: string; columns: ColumnDef[] }
export interface RoleSpec { id: string; label: string; levels: string; arity: string }
export interface OptionSpec { id: string; label: string; value: string } // one option pill from the inputs card, verbatim
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { exact: number }; categories?: { exact: number } }
export interface TestConstraints { roles: RoleConstraint[]; minRowsPerGroup: number }
export interface TestSpec {
  id: string
  name: string
  question: string
  roles: RoleSpec[]
  options: OptionSpec[]
  tables: TableSpec[]
  assumptionNote: string
  figure: { caption: string; type: string }
  howToRead: string
  apaTemplate: string
  rMap: string
  bundleFiles: string[]
  constraints: TestConstraints
}
