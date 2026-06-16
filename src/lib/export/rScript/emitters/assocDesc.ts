import type { Emitter } from './index'
import { ggsaveOrPrint } from '../helpers'
import { categoriesOf, propsArray } from '../../../data/props'

// Association + descriptive family. Each emitter mirrors the matching stats module's R verbatim
// (same call, same option threading) — NON-model tests, so no modelsummary(): the test call + its
// summary/effect-size + the card figure, emitted as clean runnable R a student could paste into RStudio.

// tails option choice -> R alternative= string (mirrors builders.ts alternativeOf).
const alternativeOf = (o: Record<string, boolean | number | string>): string =>
  ({ 'one-tailed (greater)': 'greater', 'one-tailed (less)': 'less' }[String(o['tails'] ?? 'two-tailed')] ?? 'two.sided')
// ci option choice ('95%') -> conf.level fraction (mirrors format/apa ciLevel).
const ciLevel = (v: unknown): number => { const n = Number(String(v ?? '95').replace('%', '')); return Number.isFinite(n) && n > 0 ? n / 100 : 0.95 }

const q = (s: string) => `"${s}"`
// Column accessor — `d[["col"]]` survives non-syntactic names (mirrors the ratified groups.ts col()).
const col = (c: string) => `d[["${c}"]]`
// A row-filter expression dropping NA/blank/whitespace categorical cells in `cols` (listwise), mirroring the
// stats modules' pre-tabulation filter (chiSquareIndependence/fishersExact/frequenciesCrosstabs/chiSquareGof).
const presentFilter = (cols: string[]) =>
  cols.map((c) => `!is.na(${col(c)}) & trimws(${col(c)}) != ""`).join(' & ')

export const assocDescEmitters: Record<string, Emitter> = {
  // cor.test(method="pearson", conf.level=, alternative=) → r/t/df/p/CI · geom_point()+geom_smooth(method="lm")
  pearson: (_spec, setup) => {
    const a = setup.roles['variableA'][0], b = setup.roles['variableB'][0]
    return [
      `ct <- cor.test(${col(a)}, ${col(b)}, method = "pearson", conf.level = ${ciLevel(setup.options['ci'])}, alternative = ${q(alternativeOf(setup.options))})`,
      'print(ct)',
      ggsaveOrPrint(`ggplot(d, aes(${a}, ${b})) + geom_point() + geom_smooth(method = "lm")`),
    ].join('\n')
  },

  // cor.test(method="spearman", exact=FALSE, alternative=) → rho/S/p · plain scatter
  spearman: (_spec, setup) => {
    const a = setup.roles['variableA'][0], b = setup.roles['variableB'][0]
    return [
      `ct <- suppressWarnings(cor.test(${col(a)}, ${col(b)}, method = "spearman", exact = FALSE, alternative = ${q(alternativeOf(setup.options))}))`,
      'print(ct)',
      ggsaveOrPrint(`ggplot(d, aes(${a}, ${b})) + geom_point()`),
    ].join('\n')
  },

  // cor.test(method="kendall", exact=FALSE, alternative=) → tau/z/p · plain scatter
  'kendalls-tau': (_spec, setup) => {
    const a = setup.roles['variableA'][0], b = setup.roles['variableB'][0]
    return [
      `ct <- suppressWarnings(cor.test(${col(a)}, ${col(b)}, method = "kendall", exact = FALSE, alternative = ${q(alternativeOf(setup.options))}))`,
      'print(ct)',
      ggsaveOrPrint(`ggplot(d, aes(${a}, ${b})) + geom_point()`),
    ].join('\n')
  },

  // table() → chisq.test(correct=continuity) · Cramér's V hand-computed on the UNCORRECTED χ² · grouped bar
  // Pre-filter blank/whitespace/NA cells (listwise on both cols) BEFORE table() — read.csv reads a missing
  // categorical cell as "" (a phantom category); chiSquareIndependence.ts drops those rows first.
  'chi-square-independence': (_spec, setup) => {
    const rv = setup.roles['rowVar'][0], cv = setup.roles['colVar'][0]
    const correct = setup.options['continuity'] === false ? 'FALSE' : 'TRUE'
    return [
      `sub <- d[${presentFilter([rv, cv])}, ]`,
      `tab <- table(sub[["${rv}"]], sub[["${cv}"]])`,
      `g <- suppressWarnings(chisq.test(tab, correct = ${correct}))`,
      'print(g)',
      'print(g$expected)',
      'print(prop.table(tab, 1) * 100)',
      'print(prop.table(tab, 2) * 100)',
      // Cramér's V on the uncorrected χ² (matches rcompanion::cramerV — design D1).
      'cat("Cramer\'s V:", sqrt(unname(suppressWarnings(chisq.test(tab, correct = FALSE))$statistic) / (sum(tab) * (min(dim(tab)) - 1))), "\\n")',
      ggsaveOrPrint(`ggplot(sub, aes(${rv}, fill = ${cv})) + geom_bar(position = "dodge")`),
    ].join('\n')
  },

  // table() → chisq.test(p = expected probs) · Cohen's w · observed-vs-expected dodged bars
  // Pre-filter blank/whitespace/NA cells BEFORE table() (chiSquareGof.ts drops them); the "" phantom would
  // skew counts, df, expected, and Cohen's w.
  'chi-square-goodness-of-fit': (_spec, setup, dataset) => {
    const v = setup.roles['variable'][0]
    const custom = setup.options['expectedProps'] === 'custom'
    const lines = [
      `sub <- d[${presentFilter([v])}, ]`,
      `tab <- table(sub[["${v}"]])`,
    ]
    if (custom) {
      // Category-order expected proportions (alphabetical, mirrors propsArray(categoriesOf(...))); renormalize like the module.
      const pr = propsArray(categoriesOf(dataset, v), setup.props)
      lines.push(`pr <- c(${pr.join(', ')}); pr <- pr / sum(pr)`)
      lines.push('g <- suppressWarnings(chisq.test(tab, p = pr))')
      lines.push('w <- as.numeric(effectsize::cohens_w(tab, p = pr)$Cohens_w)')
    } else {
      lines.push('g <- suppressWarnings(chisq.test(tab))') // equal-split default
      lines.push('w <- as.numeric(effectsize::cohens_w(tab)$Cohens_w)')
    }
    lines.push('print(g)', 'print(g$stdres)', 'cat("Cohen\'s w:", w, "\\n")')
    // Observed-vs-expected dodged bars.
    lines.push('k <- length(tab)')
    lines.push("gof_d <- data.frame(category = factor(rep(names(tab), 2), levels = names(tab)),")
    lines.push("  kind = factor(rep(c('Observed', 'Expected'), each = k), levels = c('Observed', 'Expected')),")
    lines.push('  count = c(as.numeric(tab), as.numeric(g$expected)))')
    lines.push(ggsaveOrPrint("ggplot(gof_d, aes(category, count, fill = kind)) + geom_col(position = \"dodge\")"))
    return lines.join('\n')
  },

  // table() → fisher.test(alternative=) (OR + CI only for 2×2) · grouped bar
  // Pre-filter blank/whitespace/NA cells BEFORE table() (fishersExact.ts drops them) to avoid the "" phantom row/col.
  'fishers-exact': (_spec, setup) => {
    const rv = setup.roles['rowVar'][0], cv = setup.roles['colVar'][0]
    return [
      `sub <- d[${presentFilter([rv, cv])}, ]`,
      `tab <- table(sub[["${rv}"]], sub[["${cv}"]])`,
      `print(fisher.test(tab, alternative = ${q(alternativeOf(setup.options))}))`,
      ggsaveOrPrint(`ggplot(sub, aes(${rv}, fill = ${cv})) + geom_bar(position = "dodge")`),
    ].join('\n')
  },

  // psych::describe per variable; grouped → mirror summaryStatistics.ts's per-level describe(data.frame(...)) loop
  // (NEVER describeBy(vector, g): psych 2.6.3 treats the bare vector as factor codes → garbage). Per-variable histogram.
  'summary-statistics': (_spec, setup) => {
    const vars = setup.roles['variables'] ?? []
    const grp = (setup.roles['groupBy'] ?? [])[0]
    const lines: string[] = []
    for (const v of vars) {
      // Pass a data.frame so psych::describe treats the column as the variable (the data.frame path
      // matches the module exactly); describeBy then groups on the column accessor, not a bare vector.
      lines.push(grp
        ? `print(psych::describeBy(data.frame(x = ${col(v)}), group = ${col(grp)}, mat = TRUE))`
        : `print(psych::describe(data.frame(x = ${col(v)})))`)
      lines.push(`print(ggplot(d, aes(${v})) + geom_histogram(bins = 12))`)
    }
    return lines.join('\n')
  },

  // janitor::tabyl frequency (1 var) or cross-tab with adorn_totals/percentages (2 vars) · bar / grouped bar
  // Pre-filter blank/whitespace/NA cells BEFORE tabyl() (frequenciesCrosstabs.ts drops them) to avoid the "" phantom row.
  'frequencies-crosstabs': (_spec, setup) => {
    const vars = (setup.roles['variables'] ?? []).slice(0, 2)
    if (vars.length < 2) {
      const v = vars[0]
      return [
        `sub <- d[${presentFilter([v])}, ]`,
        `freq <- janitor::tabyl(sub[["${v}"]])`,
        'freq$cum_percent <- cumsum(freq$percent)',
        'print(freq)',
        ggsaveOrPrint(`ggplot(sub, aes(${v})) + geom_bar()`),
      ].join('\n')
    }
    const [r, c] = vars
    return [
      `sub <- d[${presentFilter([r, c])}, ]`,
      `ct <- janitor::tabyl(sub, ${r}, ${c})`,
      "tot <- janitor::adorn_totals(ct, c('row', 'col'))",
      'print(tot)',
      "print(janitor::adorn_percentages(tot, 'row'))",
      "print(janitor::adorn_percentages(tot, 'col'))",
      ggsaveOrPrint(`ggplot(sub, aes(${r}, fill = ${c})) + geom_bar(position = "dodge")`),
    ].join('\n')
  },

  // shapiro.test + nortest::lillie.test per variable · histogram + qq figures
  // Guard both like distributionNormality.ts: shapiro only for n in [3,5000], lillie only for n >= 5 — native R's
  // lillie.test errors at n <= 4 and shapiro at n < 3, so an unguarded call halts the whole script on a small column.
  'distribution-normality': (_spec, setup) => {
    const vars = setup.roles['variable'] ?? []
    const lines: string[] = []
    for (const v of vars) {
      lines.push(`xv <- na.omit(${col(v)}); nv <- length(xv)`)
      lines.push('if (nv >= 3 && nv <= 5000) print(shapiro.test(xv)) else cat("Shapiro-Wilk: n outside [3, 5000]\\n")')
      lines.push('if (nv >= 5) print(nortest::lillie.test(xv)) else cat("Lilliefors: n too small (need n >= 5)\\n")')
      lines.push(`print(ggplot(d, aes(${v})) + geom_histogram(bins = max(5L, min(30L, ceiling(log2(length(na.omit(${col(v)}))) + 1)))) + labs(x = ${q(v)}, y = "Count"))`)
      lines.push(`print(ggplot(d, aes(sample = ${v})) + stat_qq() + stat_qq_line() + labs(x = "Theoretical quantiles", y = "Sample quantiles"))`)
    }
    return lines.join('\n')
  },
}

export const assocDescPackages: Record<string, string[]> = {
  pearson: ['ggplot2'],
  spearman: ['ggplot2'],
  'kendalls-tau': ['ggplot2'],
  'chi-square-independence': ['ggplot2'],
  'chi-square-goodness-of-fit': ['effectsize', 'ggplot2'],
  'fishers-exact': ['ggplot2'],
  'summary-statistics': ['psych', 'ggplot2'],
  'frequencies-crosstabs': ['janitor', 'ggplot2'],
  'distribution-normality': ['nortest', 'ggplot2'],
}
