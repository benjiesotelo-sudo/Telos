export const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
export const f = (n: number) => minus(n.toFixed(2))
export const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
export const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
export const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
// Running APA SENTENCE p: operator-prefixed and spaced per APA 7 ("p < .001" / "p = .034"); template reads "…, p {p}".
// (Table cells keep the compact no-space fp() — house style.)
export const fpApa = (p: number) => (p < 0.001 ? '< .001' : `= ${p.toFixed(3).replace(/^0/, '')}`)
// Bounded statistics (|x| ≤ 1: W, D, r, R², η², ω², β) drop the leading zero in the APA sentence (APA 7 §6.36).
export const f01 = (n: number, d = 2) => minus(n.toFixed(d)).replace(/^(−?)0\./, '$1.')
export const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))
export const ciLevel = (v: unknown) => { const n = Number(String(v ?? '95').replace('%', '')); return Number.isFinite(n) && n > 0 ? n / 100 : 0.95 }
