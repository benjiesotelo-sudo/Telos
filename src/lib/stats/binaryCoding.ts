// Code a 2-level column to 0/1, picking the "positive" (treated / post / present) level as 1.
// Alphabetical order is NOT safe — e.g. "pre"/"post" sorts to post<pre, which would code post=0 and flip a
// DiD sign. Prefer a known positive token; else the larger numeric; else the alphabetically-later level.
const POSITIVE = /^(1|true|yes|y|t|post|after|treated|treatment|on|present|positive|high|enrolled)$/i

export function positiveLevel(levels: string[]): string {
  // Numeric pair → the larger value is "1" (handles 0/1 and 1/2-style coding, before the "1" token can mislead).
  if (levels.every((l) => l.trim() !== '' && Number.isFinite(Number(l)))) return [...levels].sort((a, b) => Number(a) - Number(b))[1]
  const hit = levels.find((l) => POSITIVE.test(l.trim()))
  if (hit) return hit
  return [...levels].sort()[1]
}

/** 1 when `value` is the positive level, else 0. */
export const binaryCode = (value: unknown, pos: string) => (String(value) === pos ? 1 : 0)
