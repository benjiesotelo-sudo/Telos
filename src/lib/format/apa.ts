export const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
export const f = (n: number) => minus(n.toFixed(2))
export const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
export const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
export const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
export const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))
