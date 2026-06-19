/**
 * Return the column-index permutation that sorts factors/components by DESCENDING
 * sum-of-squared loadings. Ties are broken by original (lower) index — deterministic.
 *
 * @param ssLoadings  Array of per-factor SS-loadings (one value per factor column).
 * @returns           Index permutation: permutation[0] is the column with the highest SS-loading.
 */
export function orderFactors(ssLoadings: number[]): number[] {
  return ssLoadings
    .map((ss, i) => ({ ss, i }))
    .sort((a, b) => b.ss - a.ss || a.i - b.i)
    .map((item) => item.i)
}
