# 40 · Propensity score matching

**Question:** treatment effect via matching

**Scenario:** Job training: does the program raise earnings once we match on background (selection-bias demo)?

## Input configuration

- **Dataset:** `job-training.csv`
- **Configure-data overrides:** `enrolled → nominal`
- **Options:** matching: nearest; caliper off; ratio 1:1

**Role assignments** (drag column → slot):

| Column | Role slot |
|---|---|
| `post_earnings` | outcome |
| `enrolled` | treatment |
| `age` | covariates |
| `education_years` | covariates |
| `prior_earnings` | covariates |

## Files in this folder

| File | What it is |
|---|---|
| `1-input-config.png` | the configure-test screen with the columns dragged into roles + options set |
| `2-app-output.png` | the rendered results card in the app (APA table, figures, how-to-read, APA sentence) |
| `3-pdf-report.pdf` | the **PDF** export - the app's browser print-to-PDF of this result |
| `4-latex-source.tex` | the **LaTeX** export - the `report.tex` the app generates for this test |
| `5-latex-rendered.pdf` | `4-latex-source.tex` compiled (tectonic / XeTeX) |
| `export/` | the full export bundle: `analysis.R` (reproducible R script), `cleaned.csv`, table/figure PNGs, `LICENSES.txt` |

> The three outputs (app card · PDF · LaTeX) are produced from the same run, so the tables, figures, and numbers should match.
