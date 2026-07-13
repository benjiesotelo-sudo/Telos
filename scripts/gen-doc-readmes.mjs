/* Generate README.md per test folder + a top-level index for docs/test-documentation/.
   Run: node scripts/gen-doc-readmes.mjs */
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'docs/test-documentation'

// nn, id, name, question, fixture, dataConfig (human), roles [col, role], opts (human), family, scenario (one-line domain story)
const D = [
  ['01', 'summary-statistics', 'Summary statistics', 'central tendency & spread of numeric variables', 'campus-study.csv', [], [['exam_score', 'variables'], ['study_hours_per_week', 'variables'], ['gender', 'group by']], 'statistics: mean, SD, median, min/max, skew, kurtosis (grouped by gender)', 'Descriptive',
    'Campus study: exam-score and study-hour descriptives by gender (the honest null).'],
  ['02', 'frequencies-crosstabs', 'Frequencies & cross-tabs', 'counts for categorical data', 'campus-study.csv', [], [['teaching_method', 'variables']], 'counts + percentages (one variable → frequency table)', 'Descriptive',
    'Campus study: how many students landed in each teaching method.'],
  ['03', 'distribution-normality', 'Distribution & normality', 'is a variable normally distributed?', 'campus-study.csv', [], [['exam_score', 'variable'], ['absences', 'variable']], 'Shapiro-Wilk + Kolmogorov–Smirnov; histogram + Q–Q per variable', 'Descriptive',
    'Campus study: exam score looks normal, but absences is right-skewed.'],
  ['04', 'one-sample-t-test', 'One-sample t-test', 'does a mean differ from a fixed value?', 'campus-study.csv', [], [['pretest_score', 'outcome']], 'test value μ₀ = 50 (national baseline); two-tailed; α 0.05; 95% CI', 'Group comparison',
    "Campus study: do entering students' pretest scores differ from the 50-point national baseline?"],
  ['05', 'independent-t-test', 'Independent t-test', "do two groups' means differ?", 'campus-study.csv', [], [['exam_score', 'outcome'], ['gender', 'group']], 'equal variance OFF → Welch (drawn default); two-tailed; α 0.05; 95% CI', 'Group comparison',
    "Campus study: do male and female students' exam scores differ (the honest null)?"],
  ['06', 'paired-t-test', 'Paired t-test', 'do two related measurements differ?', 'sleep-caffeine.csv', [], [['sleep_baseline', 'condition A'], ['sleep_high', 'condition B']], 'two-tailed; α 0.05; 95% CI', 'Group comparison',
    'Sleep & caffeine: does a high dose reduce sleep quality versus baseline?'],
  ['07', 'one-way-anova', 'One-way ANOVA + post-hoc', 'do 3+ groups differ, and which pairs?', 'campus-study.csv', [], [['exam_score', 'outcome'], ['teaching_method', 'factor']], 'post-hoc: Tukey HSD (explicit); CI: 99% (explicit)', 'Group comparison',
    'Campus study: which teaching method produces the highest exam scores (99% CI)?'],
  ['08', 'factorial-anova', 'Factorial ANOVA', 'main effects + interaction of 2+ factors', 'campus-study.csv', [], [['exam_score', 'outcome'], ['teaching_method', 'factors'], ['gender', 'factors']], 'interactions ON; α 0.05; 95% CI', 'Group comparison',
    'Campus study: teaching method x gender on exam score.'],
  ['09', 'repeated-measures-anova', 'Repeated-measures ANOVA', '3+ conditions on the same subjects', 'sleep-caffeine.csv', ['participant_id → Used + nominal'], [['participant_id', 'subject'], ['sleep_baseline', 'measures'], ['sleep_low', 'measures'], ['sleep_high', 'measures']], 'sphericity: GG correction; post-hoc ON; α 0.05', 'Group comparison',
    'Sleep & caffeine: sleep quality across three caffeine doses, same participants.'],
  ['10', 'mixed-anova', 'Mixed ANOVA', 'between-groups × repeated conditions', 'sleep-caffeine.csv', ['participant_id → Used + nominal'], [['participant_id', 'subject'], ['tolerance_group', 'between'], ['sleep_baseline', 'measures'], ['sleep_low', 'measures'], ['sleep_high', 'measures']], 'sphericity: GG correction; post-hoc ON; α 0.05', 'Group comparison',
    'Sleep & caffeine: dose x caffeine-tolerance group on sleep quality.'],
  ['11', 'nested-anova', 'Nested ANOVA', 'one factor nested within another', 'campus-study.csv', [], [['exam_score', 'outcome'], ['school', 'factor'], ['classroom', 'nested']], 'nesting: random; α 0.05', 'Group comparison',
    'Campus study: classrooms nested within schools on exam score.'],
  ['12', 'welch-anova', "Welch's ANOVA", '3+ groups, unequal variances', 'campus-study.csv', [], [['exam_score', 'outcome'], ['teaching_method', 'factor']], 'Games-Howell post-hoc; α 0.05', 'Group comparison',
    'Campus study: teaching-method effect on exam score, unequal variances (Games-Howell post-hoc).'],
  ['13', 'ancova', 'ANCOVA', 'group means adjusted for a covariate', 'campus-study.csv', [], [['exam_score', 'outcome'], ['teaching_method', 'factor'], ['pretest_score', 'covariates']], 'adjusted means; α 0.05; 95% CI', 'Group comparison',
    'Campus study: method effect on exam score, adjusting for entering ability.'],
  ['14', 'manova', 'MANOVA', 'groups compared on several outcomes at once', 'campus-study.csv', [], [['exam_score', 'outcomes'], ['retention_score', 'outcomes'], ['teaching_method', 'factors']], 'test statistic: Pillai; follow-up ANOVAs ON; α 0.05', 'Group comparison',
    'Campus study: method effect on exam AND retention score together.'],
  ['15', 'mancova', 'MANCOVA', 'MANOVA with covariate control', 'campus-study.csv', [], [['exam_score', 'outcomes'], ['retention_score', 'outcomes'], ['teaching_method', 'factors'], ['pretest_score', 'covariates']], 'test statistic: Pillai; α 0.05', 'Group comparison',
    'Campus study: method effect on exam AND retention, adjusting for entering ability.'],
  ['16', 'mann-whitney-u', 'Mann-Whitney U', 'nonparametric two-group comparison', 'campus-study.csv', [], [['absences', 'outcome'], ['gender', 'group']], 'continuity correction ON; two-tailed; α 0.05', 'Group comparison',
    'Campus study: do absence counts (skewed) differ by gender?'],
  ['17', 'wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'nonparametric paired comparison', 'sleep-caffeine.csv', [], [['rt_baseline', 'condition A'], ['rt_high', 'condition B']], 'continuity correction ON; two-tailed; α 0.05', 'Group comparison',
    'Sleep & caffeine: does a high dose speed up reaction time (skewed RT)?'],
  ['18', 'kruskal-wallis', 'Kruskal-Wallis', 'nonparametric 3+ group comparison', 'campus-study.csv', [], [['absences', 'outcome'], ['teaching_method', 'group']], "Dunn's post-hoc; α 0.05", 'Group comparison',
    'Campus study: absence counts (skewed) across teaching methods.'],
  ['19', 'friedman', 'Friedman', 'nonparametric repeated measures', 'sleep-caffeine.csv', ['participant_id → Used + nominal'], [['participant_id', 'subject'], ['rt_baseline', 'measures'], ['rt_low', 'measures'], ['rt_high', 'measures']], 'Nemenyi post-hoc; α 0.05', 'Group comparison',
    'Sleep & caffeine: reaction time (skewed) across three doses, same participants.'],
  ['20', 'pearson', 'Pearson correlation', 'linear association of two numeric variables', 'campus-study.csv', [], [['study_hours_per_week', 'variable A'], ['exam_score', 'variable B']], 'two-tailed; α 0.05; 95% CI', 'Association',
    'Campus study: do study hours predict exam score?'],
  ['21', 'spearman', 'Spearman correlation', 'rank association (ordinal / monotonic)', 'campus-study.csv', ['motivation_1 → ordinal'], [['motivation_1', 'variable A'], ['exam_score', 'variable B']], 'two-tailed; α 0.05', 'Association',
    'Campus study: does self-reported motivation (Likert) track exam rank?'],
  ['22', 'kendalls-tau', "Kendall's tau", 'rank association, robust to ties', 'campus-study.csv', ['motivation_1 → ordinal', 'motivation_2 → ordinal'], [['motivation_1', 'variable A'], ['motivation_2', 'variable B']], 'two-tailed; α 0.05', 'Association',
    'Campus study: do two motivation-scale items agree (rank concordance)?'],
  ['23', 'chi-square-independence', 'Chi-square independence', 'are two categorical variables related?', 'campus-study.csv', [], [['teaching_method', 'row variable'], ['passed_course', 'column variable']], 'continuity correction ON (2×2 only); α 0.05', 'Association',
    'Campus study: is teaching method related to pass/fail?'],
  ['24', 'chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'do counts match an expected split?', 'campus-study.csv', [], [['teaching_method', 'variable']], 'expected proportions: custom - Lecture 0.5 / Blended 0.3 / Flipped 0.2; α 0.05', 'Association',
    "Campus study: does enrollment match the department's planned 50/30/20 method split?"],
  ['25', 'fishers-exact', "Fisher's exact", 'exact test for small categorical tables', 'campus-study.csv', [], [['gender', 'row variable'], ['passed_course', 'column variable']], 'two-tailed; α 0.05', 'Association',
    'Campus study: gender x pass/fail, exact test.'],
  ['26', 'simple-linear-regression', 'Simple linear regression', 'one numeric outcome, one predictor', 'campus-study.csv', [], [['exam_score', 'outcome'], ['study_hours_per_week', 'predictor']], 'α 0.05; 95% CI', 'Regression',
    'Campus study: predicting exam score from study hours alone.'],
  ['27', 'multiple-linear-regression', 'Multiple linear regression', 'one numeric outcome, several predictors', 'campus-study.csv', [], [['exam_score', 'outcome'], ['pretest_score', 'predictors'], ['study_hours_per_week', 'predictors'], ['teaching_method', 'predictors']], 'standardize OFF (drawn default); α 0.05; 95% CI', 'Regression',
    'Campus study: exam score from entering ability, study hours, and method together.'],
  ['28', 'logistic-regression', 'Logistic regression', 'predict a yes/no outcome', 'campus-study.csv', [], [['passed_course', 'outcome'], ['pretest_score', 'predictors'], ['study_hours_per_week', 'predictors'], ['teaching_method', 'predictors']], 'event category: Yes; report odds ratios ON; classification table ON; α 0.05; 95% CI', 'Regression',
    'Campus study: predicting pass/fail from ability, effort, and method (classification table).'],
  ['29', 'poisson-negative-binomial', 'Poisson / negative binomial', 'predict a count outcome', 'campus-study.csv', [], [['absences', 'outcome (count)'], ['teaching_method', 'predictors'], ['gender', 'predictors'], ['weeks_enrolled', 'exposure (offset)']], 'model: Poisson; overdispersed → negative binomial is the better fit; α 0.05; 95% CI', 'Regression',
    'Campus study: modeling overdispersed absence counts by method and gender.'],
  ['30', 'arima-sarima', 'ARIMA / SARIMA', 'model & forecast one series', 'macro-quarterly.csv', [], [['quarter', 'time'], ['gdp_growth', 'series']], 'order: auto-select; seasonal period 4; forecast horizon 8', 'Econometrics · time series',
    'Macro quarterly: forecasting GDP growth over an 8-year business cycle.'],
  ['31', 'stationarity-tests', 'Stationarity tests (ADF, KPSS)', 'is the series stationary?', 'macro-quarterly.csv', [], [['quarter', 'time'], ['gdp_growth', 'series']], 'test: ADF + KPSS (+ Phillips–Perron); lags auto; α 0.05', 'Econometrics · time series',
    'Macro quarterly: is GDP growth stationary around its cyclical mean?'],
  ['32', 'granger-causality', 'Granger causality', 'does X predict future Y?', 'macro-quarterly.csv', [], [['quarter', 'time'], ['gdp_growth', 'series X (predictor)'], ['unemployment', 'series Y (outcome)']], 'max lag 4; α 0.05', 'Econometrics · time series',
    "Macro quarterly: does GDP growth predict next quarter's unemployment (Okun's law)?"],
  ['33', 'var', 'VAR', 'several interrelated series', 'macro-quarterly.csv', [], [['quarter', 'time'], ['gdp_growth', 'series'], ['inflation', 'series'], ['unemployment', 'series']], 'lag order auto; IRF horizon 8; + FEVD table', 'Econometrics · time series',
    'Macro quarterly: joint dynamics of growth, inflation, and unemployment.'],
  ['34', 'fixed-effects', 'Fixed effects', 'panel regression, entity effects', 'province-panel.csv', ['year → ordinal'], [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], 'effects: entity; std. errors: clustered by entity; α 0.05', 'Econometrics · panel',
    'Province panel: does investment raise growth, controlling for province effects?'],
  ['35', 'random-effects', 'Random effects', 'panel regression, random entity effects', 'province-panel.csv', ['year → ordinal'], [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], 'std. errors: clustered by entity; α 0.05', 'Econometrics · panel',
    "Province panel: random-effects estimate of investment's growth effect."],
  ['36', 'hausman-test', 'Hausman test', 'fixed vs. random effects?', 'province-panel.csv', ['year → ordinal'], [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], 'α 0.05 (side-by-side FE | RE + χ² span)', 'Econometrics · panel',
    'Province panel: fixed vs. random effects for the investment-growth model.'],
  ['37', 'did', 'Difference-in-differences (DiD)', 'policy effect, before/after × treated/control', 'minwage-employment.csv', ['year → ordinal', 'treated → nominal', 'post → nominal'], [['employment', 'outcome'], ['treated', 'treatment'], ['post', 'period'], ['state', 'entity'], ['year', 'time']], 'std. errors: clustered; covariates: none; α 0.05; pre-trends F-test (4 pre-period years)', 'Econometrics · causal',
    'Minimum wage: did the 2018 hike change employment relative to non-hike states (parallel pre-trends)?'],
  ['38', 'rdd', 'Regression discontinuity (RDD)', 'effect at a cutoff', 'scholarship.csv', [], [['later_gpa', 'outcome'], ['entrance_score', 'running variable']], 'cutoff 60 (explicit); bandwidth auto + half/double bandwidth-sensitivity re-estimates; polynomial order 1 (linear)', 'Econometrics · causal',
    'Scholarship: does crossing the entrance-score cutoff raise later GPA (bandwidth-sensitivity check)?'],
  ['39', 'iv-2sls', 'Instrumental variables (IV / 2SLS)', 'effect with an endogenous predictor', 'returns-education.csv', [], [['wage', 'outcome'], ['education', 'endogenous'], ['mother_education', 'instruments'], ['experience', 'controls']], 'std. errors: robust; weak-instrument test ON; α 0.05', 'Econometrics · causal',
    "Returns to education: causal wage effect of schooling, instrumented by mother's education."],
  ['40', 'propensity-score-matching', 'Propensity score matching', 'treatment effect via matching', 'job-training.csv', ['enrolled → nominal'], [['post_earnings', 'outcome'], ['enrolled', 'treatment'], ['age', 'covariates'], ['education_years', 'covariates'], ['prior_earnings', 'covariates']], 'matching: nearest; caliper off; ratio 1:1', 'Econometrics · causal',
    'Job training: does the program raise earnings once we match on background (selection-bias demo)?'],
  ['41', 'cronbachs-alpha', "Cronbach's alpha", 'internal consistency of one scale', 'tourism-esg.csv', ['esg1 → interval', 'esg2 → interval', 'esg3 → interval', 'esg4 → interval'], [['esg1', 'items'], ['esg2', 'items'], ['esg3', 'items'], ['esg4', 'items']], "McDonald's ω headline + Cronbach's α secondary; standardized α OFF; drop-item statistics ON; 95% CI", 'Latent variables · reliability',
    'Tourism ESG: internal consistency of the ESG-perception scale.'],
  ['42', 'ave', 'Average variance extracted (AVE)', 'convergent & discriminant validity of constructs', 'tourism-esg.csv', [], [['esg', 'esg1–4'], ['norm', 'norm1–4'], ['intent', 'intent1–3'], ['attitude', 'attitude1–4'], ['service_quality', 'service_quality1–4']], 'estimator: ML (continuous) · WLSMV (ordinal); AVE + CR + ω + α table; Fornell-Larcker matrix; HTMT matrix (all five constructs)', 'Latent variables · reliability',
    'Tourism ESG: convergent & discriminant validity across all five constructs.'],
  ['43', 'composite-reliability', 'Composite reliability (CR)', 'reliability of each construct', 'tourism-esg.csv', [], [['esg', 'esg1–4'], ['norm', 'norm1–4'], ['intent', 'intent1–3'], ['attitude', 'attitude1–4'], ['service_quality', 'service_quality1–4']], 'estimator: ML (continuous) · WLSMV (ordinal); CR + AVE + ω + α (CR = ω for a congeneric model)', 'Latent variables · reliability',
    'Tourism ESG: composite reliability of each construct.'],
  ['44', 'efa', 'Exploratory factor analysis (EFA)', 'underlying factors behind a set of items', 'tourism-esg.csv', [], [['esg1', 'items'], ['esg2', 'items'], ['esg3', 'items'], ['esg4', 'items'], ['norm1', 'items'], ['norm2', 'items'], ['norm3', 'items'], ['norm4', 'items'], ['intent1', 'items'], ['intent2', 'items'], ['intent3', 'items']], 'extraction: PAF; rotation: oblimin (explicit); retention: parallel analysis; loadings |< .32| suppressed', 'Latent variables · factor analysis',
    'Tourism ESG: do ESG perception, norm, and intention form three distinct factors?'],
  ['45', 'pca', 'Principal component analysis (PCA)', 'reduce many variables to a few components', 'tourism-esg.csv', [], [['esg1', 'variables'], ['esg2', 'variables'], ['esg3', 'variables'], ['esg4', 'variables'], ['norm1', 'variables'], ['norm2', 'variables'], ['norm3', 'variables'], ['norm4', 'variables'], ['intent1', 'variables'], ['intent2', 'variables'], ['intent3', 'variables']], 'retention: parallel analysis; standardize ON (correlation matrix); loadings |< .32| suppressed; no communalities', 'Data reduction',
    'Tourism ESG: reducing 11 survey items to a handful of components.'],
  ['46', 'cb-sem', 'CB-SEM', 'confirmatory structural model among latent constructs', 'tourism-esg.csv', [], [['esg', 'esg1–4'], ['norm', 'norm1–4'], ['service_quality', 'service_quality1–4'], ['attitude', 'attitude1–4 (moderator)'], ['intent', 'intent1–3']], 'input: construct-slots form (constructs) + AMOS canvas (structural paths + moderation gesture). Paths drawn: esg → intent, norm → intent, service_quality → intent; attitude MODERATES norm → intent (click attitude oval, then the path midpoint). estimator ML; pipeline full (EFA → CFA → fit → structural); bootstrap preset 1,000 (percentile CI, docs-speed preset)', 'Latent variables · SEM',
    'Tourism ESG: does environmental attitude strengthen the norm-intention link (moderation, interaction-plot figure)?'],
  ['47', 'pls-sem', 'PLS-SEM', 'variance-based structural model (prediction-oriented)', 'tourism-esg.csv', [], [['esg', 'esg1–4 (reflective)'], ['norm', 'norm1–4 (reflective)'], ['service_quality', 'service_quality1–4 (reflective)'], ['attitude', 'attitude1–4 (moderator)'], ['intent', 'intent1–3 (reflective)']], 'input: construct-slots form (constructs; reflective/formative) + AMOS canvas (structural paths + moderation gesture, seminr interaction_term two-stage). Paths drawn: esg → intent, norm → intent, service_quality → intent; attitude MODERATES norm → intent. weighting: path; bootstrap preset 1,000 (percentile CI, docs-speed preset); HTMT, f², Q²_predict', 'Latent variables · SEM',
    'Tourism ESG: the same moderated structural model, estimated variance-based (PLS interaction_term).'],
  // path-analysis (48): observed-only path mode - no constructs/roles. The "roles" column carries the
  // OBSERVED composite-score columns + the drawn structural paths (rendered specially below; isPath branch).
  ['48', 'path-analysis', 'Path analysis', 'directed-path model among observed variables', 'tourism-esg.csv', ['19 raw items + attitude_score/service_quality_score → Unused (keep esg_score, norm_score, intent_score)'], [['observed', 'esg_score, norm_score, intent_score'], ['paths', 'esg_score → norm_score, norm_score → intent_score, esg_score → intent_score (single mediator with direct effect)']], 'input: AMOS canvas (one rectangle per used column; structural paths drawn between observed composite scores - no measurement model). Model is df = 0 saturated → fit indices suppressed; indirect effect esg_score → norm_score → intent_score with bootstrap preset 1,000 (percentile CI, docs-speed preset); estimator ML', 'Latent variables · SEM',
    "Tourism ESG: does ESG perception's effect on intention run partly through norm (observed composites)?"],
]

const rolesTable = (roles) => roles.map(([c, r]) => `| \`${c}\` | ${r} |`).join('\n')

for (const [nn, id, name, question, fixture, dataCfg, roles, opts, , scenario] of D) {
  const folder = join(OUT, `${nn}_${id}`)
  if (!existsSync(folder)) { console.warn('missing folder', folder); continue }
  const isSem = id === 'cb-sem' || id === 'pls-sem'
  const isPath = id === 'path-analysis'
  const isConstruct = id === 'ave' || id === 'composite-reliability' || isSem
  const md = `# ${nn} · ${name}

**Question:** ${question}

**Scenario:** ${scenario}

## Input configuration

- **Dataset:** \`${fixture}\`
${dataCfg.length ? `- **Configure-data overrides:** ${dataCfg.map((s) => `\`${s}\``).join(', ')}\n` : '- **Configure-data:** app defaults (auto-detected types/levels)\n'}- **Options:** ${opts}

${isPath ? '**Path model** - observed-only path mode: one rectangle per used column on the AMOS canvas, structural paths drawn directly between observed variables (no measurement model / no constructs):' : isSem ? '**Measurement model** - constructs defined in the construct-slots form (structural paths drawn on the AMOS canvas; see Options):' : isConstruct ? '**Constructs** (construct-slots input - name each construct, tick its items):' : '**Role assignments** (drag column → slot):'}

| ${isPath ? 'Model element | Value' : isConstruct ? 'Construct | Items' : 'Column | Role slot'} |
|---|---|
${rolesTable(roles)}

## Files in this folder

| File | What it is |
|---|---|
| \`1-input-config.png\` | the configure-test screen with the columns dragged into roles + options set |
| \`2-app-output.png\` | the rendered results card in the app (APA table, figures, how-to-read, APA sentence) |
| \`3-pdf-report.pdf\` | the **PDF** export - the app's browser print-to-PDF of this result |
| \`4-latex-source.tex\` | the **LaTeX** export - the \`report.tex\` the app generates for this test |
| \`5-latex-rendered.pdf\` | \`4-latex-source.tex\` compiled (tectonic / XeTeX) |
| \`export/\` | the full export bundle: \`analysis.R\` (reproducible R script), \`cleaned.csv\`, table/figure PNGs, \`LICENSES.txt\` |

> The three outputs (app card · PDF · LaTeX) are produced from the same run, so the tables, figures, and numbers should match.
`
  writeFileSync(join(folder, 'README.md'), md)
}

// Top-level index
const byFamily = {}
// D rows are [nn, id, name, question, fixture, dataCfg, roles, opts, family, scenario] - family is index 8.
for (const [nn, id, name, question, , , , , family, scenario] of D) {
  ;(byFamily[family] ??= []).push(`| ${nn} | [${name}](${nn}_${id}/) | ${question} | ${scenario} |`)
}
let index = `# Telos - per-test documentation

Auto-generated capture of **all 48 live tests**. Each test has its own folder \`NN_<id>/\` containing the
research question, the scenario (the domain story the test data tells), the input configuration
(screenshot), and the three outputs - the in-app result, the PDF export, and the LaTeX export
(source + compiled). See each folder's \`README.md\`.

Generated by driving the real app (\`tests/docs/document-tests.spec.ts\`) on the project's test fixtures,
then compiling each LaTeX piece with tectonic. The three outputs share one run, so they should agree.

`
for (const fam of ['Descriptive', 'Group comparison', 'Association', 'Regression', 'Econometrics · time series', 'Econometrics · panel', 'Econometrics · causal', 'Latent variables · reliability', 'Latent variables · factor analysis', 'Latent variables · SEM', 'Data reduction']) {
  if (!byFamily[fam]) continue
  index += `## ${fam}\n\n| # | Test | Question | Scenario |\n|---|---|---|---|\n${byFamily[fam].join('\n')}\n\n`
}
writeFileSync(join(OUT, 'README.md'), index)
console.log(`Wrote ${D.length} per-test READMEs + index.`)
