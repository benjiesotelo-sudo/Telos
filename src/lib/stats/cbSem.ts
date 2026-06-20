// CB-SEM result type — single source of truth lives in runCbSem.ts (Unit 6).
// Re-exported here so the original importer (SemCanvas, Unit 3a) keeps a stable path
// and there is exactly ONE CbSemResult definition (number-keyed rsquare per the plan's
// Shared Interfaces). The Unit-3a stub that previously diverged (string-keyed rsquare)
// is replaced by this re-export.
export type { CbSemResult } from './runCbSem'
