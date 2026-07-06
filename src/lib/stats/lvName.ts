// Lavaan/R model syntax (`=~`, `~`, `:=`) requires bare identifiers — a construct display name like
// "ESG Perception" is illegal there (the space breaks the parser; downstream indexing by the raw name
// then goes out of bounds because the fitted model never had that latent name). Use lvName/lvNames to
// turn a user-typed display name into a valid, unique R token for R-SIDE SYNTAX AND INDEXING ONLY.
// UI-facing tables/labels must keep the ORIGINAL display name — map back by construct id/order, which
// is stable everywhere in this codebase.

/** Sanitize a single display name into a syntactically valid lavaan/R identifier: every run of
 *  non-alphanumeric characters collapses to one underscore (also trimmed from both ends); a name that
 *  starts with a digit is prefixed with 'X'; a name that sanitizes to nothing falls back to 'X'. */
export function lvName(name: string): string {
  let s = name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (s === '') s = 'X'
  if (/^[0-9]/.test(s)) s = `X${s}`
  return s
}

/** Sanitize a list of display names with lvName, deterministically deduping collisions in input order
 *  by appending _2, _3, ... to the 2nd+ occurrence of each sanitized base (e.g. two names that both
 *  sanitize to "A_B" become ["A_B", "A_B_2"]). */
export function lvNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const base = lvName(name)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}_${count}`
  })
}
