/* Generate README.md per test folder + a top-level index for docs/test-documentation/.
   Run: node scripts/gen-doc-readmes.mjs */
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'docs/test-documentation'

// nn, id, name, question, fixture, dataConfig (human), roles [col, role], opts (human), family
const D = [
  ['01', 'summary-statistics', 'Summary statistics', 'central tendency & spread of numeric variables', 'students.csv', [], [['score', 'variables'], ['anxiety', 'variables'], ['gender', 'group by']], 'statistics: mean, SD, median, min/max, skew, kurtosis (grouped by gender)', 'Descriptive'],
  ['02', 'frequencies-crosstabs', 'Frequencies & cross-tabs', 'counts for categorical data', 'study.csv', [], [['group', 'variables']], 'counts + percentages (one variable → frequency table)', 'Descriptive'],
  ['03', 'distribution-normality', 'Distribution & normality', 'is a variable normally distributed?', 'students.csv', [], [['score', 'variable'], ['anxiety', 'variable']], 'Shapiro-Wilk + Kolmogorov–Smirnov; histogram + Q–Q per variable', 'Descriptive'],
  ['04', 'one-sample-t-test', 'One-sample t-test', 'does a mean differ from a fixed value?', 'paired.csv', [], [['post', 'outcome']], 'test value μ₀ = 70; two-tailed; α 0.05; 95% CI', 'Group comparison'],
  ['05', 'independent-t-test', 'Independent t-test', "do two groups' means differ?", 'study.csv', [], [['score', 'outcome'], ['group', 'group']], 'equal variance OFF → Welch (drawn default); two-tailed; α 0.05; 95% CI', 'Group comparison'],
  ['06', 'paired-t-test', 'Paired t-test', 'do two related measurements differ?', 'paired.csv', [], [['pre', 'condition A'], ['post', 'condition B']], 'two-tailed; α 0.05; 95% CI', 'Group comparison'],
  ['07', 'one-way-anova', 'One-way ANOVA + post-hoc', 'do 3+ groups differ, and which pairs?', 'anova.csv', [], [['outcome', 'outcome'], ['group', 'factor']], 'post-hoc: Tukey HSD; α 0.05; 95% CI', 'Group comparison'],
  ['08', 'factorial-anova', 'Factorial ANOVA', 'main effects + interaction of 2+ factors', 'anova.csv', [], [['outcome', 'outcome'], ['group', 'factors'], ['gender', 'factors']], 'interactions ON; α 0.05; 95% CI', 'Group comparison'],
  ['09', 'repeated-measures-anova', 'Repeated-measures ANOVA', '3+ conditions on the same subjects', 'anova.csv', ['subject_id → Used + nominal'], [['subject_id', 'subject'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], 'sphericity: GG correction; post-hoc ON; α 0.05', 'Group comparison'],
  ['10', 'mixed-anova', 'Mixed ANOVA', 'between-groups × repeated conditions', 'anova.csv', ['subject_id → Used + nominal'], [['subject_id', 'subject'], ['group', 'between'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], 'sphericity: GG correction; post-hoc ON; α 0.05', 'Group comparison'],
  ['11', 'nested-anova', 'Nested ANOVA', 'one factor nested within another', 'anova.csv', [], [['outcome', 'outcome'], ['school', 'factor'], ['classroom', 'nested']], 'nesting: random; α 0.05', 'Group comparison'],
  ['12', 'welch-anova', "Welch's ANOVA", '3+ groups, unequal variances', 'anova.csv', [], [['outcome', 'outcome'], ['group', 'factor']], 'Games-Howell post-hoc; α 0.05', 'Group comparison'],
  ['13', 'ancova', 'ANCOVA', 'group means adjusted for a covariate', 'anova.csv', [], [['outcome', 'outcome'], ['group', 'factor'], ['baseline', 'covariates']], 'adjusted means; α 0.05; 95% CI', 'Group comparison'],
  ['14', 'manova', 'MANOVA', 'groups compared on several outcomes at once', 'anova.csv', [], [['outcome', 'outcomes'], ['outcome2', 'outcomes'], ['group', 'factors']], 'test statistic: Pillai; follow-up ANOVAs ON; α 0.05', 'Group comparison'],
  ['15', 'mancova', 'MANCOVA', 'MANOVA with covariate control', 'anova.csv', [], [['outcome', 'outcomes'], ['outcome2', 'outcomes'], ['group', 'factors'], ['baseline', 'covariates']], 'test statistic: Pillai; α 0.05', 'Group comparison'],
  ['16', 'mann-whitney-u', 'Mann-Whitney U', 'nonparametric two-group comparison', 'study.csv', [], [['score', 'outcome'], ['group', 'group']], 'continuity correction ON; two-tailed; α 0.05', 'Group comparison'],
  ['17', 'wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'nonparametric paired comparison', 'paired.csv', [], [['pre', 'condition A'], ['post', 'condition B']], 'continuity correction ON; two-tailed; α 0.05', 'Group comparison'],
  ['18', 'kruskal-wallis', 'Kruskal-Wallis', 'nonparametric 3+ group comparison', 'anova.csv', [], [['outcome', 'outcome'], ['group', 'group']], "Dunn's post-hoc; α 0.05", 'Group comparison'],
  ['19', 'friedman', 'Friedman', 'nonparametric repeated measures', 'anova.csv', ['subject_id → Used + nominal'], [['subject_id', 'subject'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], 'Nemenyi post-hoc; α 0.05', 'Group comparison'],
  ['20', 'pearson', 'Pearson correlation', 'linear association of two numeric variables', 'association.csv', [], [['hours_studied', 'variable A'], ['exam_score', 'variable B']], 'two-tailed; α 0.05; 95% CI', 'Association'],
  ['21', 'spearman', 'Spearman correlation', 'rank association (ordinal / monotonic)', 'association.csv', ['satisfaction → ordinal', 'motivation → ordinal'], [['satisfaction', 'variable A'], ['motivation', 'variable B']], 'two-tailed; α 0.05', 'Association'],
  ['22', 'kendalls-tau', "Kendall's tau", 'rank association, robust to ties', 'association.csv', ['satisfaction → ordinal', 'motivation → ordinal'], [['satisfaction', 'variable A'], ['motivation', 'variable B']], 'two-tailed; α 0.05', 'Association'],
  ['23', 'chi-square-independence', 'Chi-square independence', 'are two categorical variables related?', 'association.csv', [], [['method', 'row variable'], ['passed', 'column variable']], 'continuity correction ON (2×2 only); α 0.05', 'Association'],
  ['24', 'chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'do counts match an expected split?', 'association.csv', [], [['method', 'variable']], 'expected proportions: custom — discussion 0.5 / lecture 0.3 / seminar 0.2; α 0.05', 'Association'],
  ['25', 'fishers-exact', "Fisher's exact", 'exact test for small categorical tables', 'association.csv', [], [['passed', 'row variable'], ['gender', 'column variable']], 'two-tailed; α 0.05', 'Association'],
  ['26', 'simple-linear-regression', 'Simple linear regression', 'one numeric outcome, one predictor', 'regression.csv', [], [['post_score', 'outcome'], ['pre_score', 'predictor']], 'α 0.05; 95% CI', 'Regression'],
  ['27', 'multiple-linear-regression', 'Multiple linear regression', 'one numeric outcome, several predictors', 'regression.csv', [], [['post_score', 'outcome'], ['pre_score', 'predictors'], ['age', 'predictors'], ['group', 'predictors'], ['method', 'predictors']], 'standardize OFF (drawn default); α 0.05; 95% CI', 'Regression'],
  ['28', 'logistic-regression', 'Logistic regression', 'predict a yes/no outcome', 'regression.csv', [], [['passed', 'outcome'], ['pre_score', 'predictors'], ['age', 'predictors'], ['group', 'predictors']], 'event category: yes; report odds ratios ON; α 0.05; 95% CI', 'Regression'],
  ['29', 'poisson-negative-binomial', 'Poisson / negative binomial', 'predict a count outcome', 'regression.csv', [], [['complaints', 'outcome (count)'], ['age', 'predictors'], ['group', 'predictors'], ['months_observed', 'exposure (offset)']], 'model: Poisson; α 0.05; 95% CI', 'Regression'],
  ['30', 'arima-sarima', 'ARIMA / SARIMA', 'model & forecast one series', 'timeseries.csv', [], [['month', 'time'], ['sales', 'series']], 'order: auto-select; seasonal period 12; forecast horizon 12', 'Econometrics · time series'],
  ['31', 'stationarity-tests', 'Stationarity tests (ADF, KPSS)', 'is the series stationary?', 'timeseries.csv', [], [['month', 'time'], ['sales', 'series']], 'test: ADF + KPSS (+ Phillips–Perron); lags auto; α 0.05', 'Econometrics · time series'],
  ['32', 'granger-causality', 'Granger causality', 'does X predict future Y?', 'timeseries.csv', [], [['month', 'time'], ['ad_spend', 'series X (predictor)'], ['sales', 'series Y (outcome)']], 'max lag 4; α 0.05', 'Econometrics · time series'],
  ['33', 'var', 'VAR', 'several interrelated series', 'timeseries.csv', [], [['month', 'time'], ['sales', 'series'], ['visitors', 'series']], 'lag order auto; IRF horizon 10; + FEVD table', 'Econometrics · time series'],
  ['34', 'fixed-effects', 'Fixed effects', 'panel regression, entity effects', 'panel.csv', ['year → ordinal'], [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], 'effects: entity; std. errors: clustered by entity; α 0.05', 'Econometrics · panel'],
  ['35', 'random-effects', 'Random effects', 'panel regression, random entity effects', 'panel.csv', ['year → ordinal'], [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], 'std. errors: clustered by entity; α 0.05', 'Econometrics · panel'],
  ['36', 'hausman-test', 'Hausman test', 'fixed vs. random effects?', 'panel.csv', ['year → ordinal'], [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], 'α 0.05 (side-by-side FE | RE + χ² span)', 'Econometrics · panel'],
  ['37', 'did', 'Difference-in-differences (DiD)', 'policy effect, before/after × treated/control', 'panel.csv', ['year → ordinal', 'treated → nominal', 'post → nominal'], [['roa', 'outcome'], ['treated', 'treatment'], ['post', 'period'], ['firm', 'entity'], ['year', 'time']], 'std. errors: clustered; covariates: none; α 0.05', 'Econometrics · causal'],
  ['38', 'rdd', 'Regression discontinuity (RDD)', 'effect at a cutoff', 'causal.csv', [], [['score', 'outcome'], ['running_var', 'running variable']], 'cutoff 50; bandwidth auto; polynomial order 1 (linear)', 'Econometrics · causal'],
  ['39', 'iv-2sls', 'Instrumental variables (IV / 2SLS)', 'effect with an endogenous predictor', 'causal.csv', [], [['wage', 'outcome'], ['educ', 'endogenous'], ['educ_iv', 'instruments'], ['exper', 'controls']], 'std. errors: robust; weak-instrument test ON; α 0.05', 'Econometrics · causal'],
  ['40', 'propensity-score-matching', 'Propensity score matching', 'treatment effect via matching', 'causal.csv', ['enroll → nominal'], [['health', 'outcome'], ['enroll', 'treatment'], ['exper', 'covariates'], ['age', 'covariates'], ['ability', 'covariates']], 'matching: nearest; caliper off; ratio 1:1', 'Econometrics · causal'],
  ['41', 'cronbachs-alpha', "Cronbach's alpha", 'internal consistency of one scale', 'scale.csv', ['x1 → interval', 'x2 → interval', 'x3 → interval'], [['x1', 'items'], ['x2', 'items'], ['x3', 'items']], "McDonald's ω headline + Cronbach's α secondary; standardized α OFF; drop-item statistics ON; 95% CI", 'Latent variables · reliability'],
  ['42', 'ave', 'Average variance extracted (AVE)', 'convergent & discriminant validity of constructs', 'scale.csv', [], [['visual', 'x1, x2, x3'], ['textual', 'x4, x5, x6'], ['speed', 'x7, x8, x9']], 'estimator: ML (continuous) · WLSMV (ordinal); AVE + CR + ω + α table; Fornell-Larcker matrix; HTMT matrix', 'Latent variables · reliability'],
  ['43', 'composite-reliability', 'Composite reliability (CR)', 'reliability of each construct', 'scale.csv', [], [['visual', 'x1, x2, x3'], ['textual', 'x4, x5, x6'], ['speed', 'x7, x8, x9']], 'estimator: ML (continuous) · WLSMV (ordinal); CR + AVE + ω + α (CR = ω for a congeneric model)', 'Latent variables · reliability'],
  ['44', 'efa', 'Exploratory factor analysis (EFA)', 'underlying factors behind a set of items', 'scale.csv', [], [['x1', 'items'], ['x2', 'items'], ['x3', 'items'], ['x4', 'items'], ['x5', 'items'], ['x6', 'items'], ['x7', 'items'], ['x8', 'items'], ['x9', 'items']], 'extraction: PAF; rotation: oblimin; retention: parallel analysis; loadings |< .32| suppressed', 'Latent variables · factor analysis'],
  ['45', 'pca', 'Principal component analysis (PCA)', 'reduce many variables to a few components', 'scale.csv', [], [['x1', 'variables'], ['x2', 'variables'], ['x3', 'variables'], ['x4', 'variables'], ['x5', 'variables'], ['x6', 'variables'], ['x7', 'variables'], ['x8', 'variables'], ['x9', 'variables']], 'retention: parallel analysis; standardize ON (correlation matrix); loadings |< .32| suppressed; no communalities', 'Data reduction'],
  ['46', 'cb-sem', 'CB-SEM', 'confirmatory structural model among latent constructs', 'scale.csv', [], [['visual', 'x1, x2, x3'], ['textual', 'x4, x5, x6'], ['speed', 'x7, x8, x9']], 'input: construct-slots form (constructs) + AMOS canvas (structural paths). Paths drawn: visual → textual, textual → speed, visual → speed (mediation). estimator ML; pipeline full (EFA → CFA → fit → structural); bootstrap 5000 (percentile CI)', 'Latent variables · SEM'],
  ['47', 'pls-sem', 'PLS-SEM', 'variance-based structural model (prediction-oriented)', 'scale.csv', [], [['visual', 'x1, x2, x3 (reflective)'], ['textual', 'x4, x5, x6 (reflective)'], ['speed', 'x7, x8, x9 (reflective)']], 'input: construct-slots form (constructs; reflective/formative) + AMOS canvas (structural paths). Paths drawn: visual → textual, textual → speed, visual → speed. weighting: path; bootstrap 5000 (percentile CI); HTMT, f², Q²_predict', 'Latent variables · SEM'],
]

const rolesTable = (roles) => roles.map(([c, r]) => `| \`${c}\` | ${r} |`).join('\n')

for (const [nn, id, name, question, fixture, dataCfg, roles, opts] of D) {
  const folder = join(OUT, `${nn}_${id}`)
  if (!existsSync(folder)) { console.warn('missing folder', folder); continue }
  const isSem = id === 'cb-sem' || id === 'pls-sem'
  const isConstruct = id === 'ave' || id === 'composite-reliability' || isSem
  const md = `# ${nn} · ${name}

**Question:** ${question}

## Input configuration

- **Dataset:** \`${fixture}\`
${dataCfg.length ? `- **Configure-data overrides:** ${dataCfg.map((s) => `\`${s}\``).join(', ')}\n` : '- **Configure-data:** app defaults (auto-detected types/levels)\n'}- **Options:** ${opts}

${isSem ? '**Measurement model** — constructs defined in the construct-slots form (structural paths drawn on the AMOS canvas; see Options):' : isConstruct ? '**Constructs** (construct-slots input — name each construct, tick its items):' : '**Role assignments** (drag column → slot):'}

| ${isConstruct ? 'Construct | Items' : 'Column | Role slot'} |
|---|---|
${rolesTable(roles)}

## Files in this folder

| File | What it is |
|---|---|
| \`1-input-config.png\` | the configure-test screen with the columns dragged into roles + options set |
| \`2-app-output.png\` | the rendered results card in the app (APA table, figures, how-to-read, APA sentence) |
| \`3-pdf-report.pdf\` | the **PDF** export — the app's browser print-to-PDF of this result |
| \`4-latex-source.tex\` | the **LaTeX** export — the \`report.tex\` the app generates for this test |
| \`5-latex-rendered.pdf\` | \`4-latex-source.tex\` compiled (tectonic / XeTeX) |
| \`export/\` | the full export bundle: \`analysis.R\` (reproducible R script), \`cleaned.csv\`, table/figure PNGs, \`LICENSES.txt\` |

> The three outputs (app card · PDF · LaTeX) are produced from the same run, so the tables, figures, and numbers should match.
`
  writeFileSync(join(folder, 'README.md'), md)
}

// Top-level index
const byFamily = {}
// D rows are [nn, id, name, question, fixture, dataCfg, roles, opts, family] — family is index 8.
for (const [nn, id, name, question, , , , , family] of D) {
  ;(byFamily[family] ??= []).push(`| ${nn} | [${name}](${nn}_${id}/) | ${question} |`)
}
let index = `# Telos — per-test documentation

Auto-generated capture of **47 of the 48 live tests** (path analysis is documented once its canvas path-mode UI bridge lands). Each test has its own folder \`NN_<id>/\` containing the
research question, the input configuration (screenshot), and the three outputs — the in-app result, the
PDF export, and the LaTeX export (source + compiled). See each folder's \`README.md\`.

Generated by driving the real app (\`tests/docs/document-tests.spec.ts\`) on the project's test fixtures,
then compiling each LaTeX piece with tectonic. The three outputs share one run, so they should agree.

`
for (const fam of ['Descriptive', 'Group comparison', 'Association', 'Regression', 'Econometrics · time series', 'Econometrics · panel', 'Econometrics · causal', 'Latent variables · reliability', 'Latent variables · factor analysis', 'Latent variables · SEM', 'Data reduction']) {
  if (!byFamily[fam]) continue
  index += `## ${fam}\n\n| # | Test | Question |\n|---|---|---|\n${byFamily[fam].join('\n')}\n\n`
}
writeFileSync(join(OUT, 'README.md'), index)
console.log(`Wrote ${D.length} per-test READMEs + index.`)
