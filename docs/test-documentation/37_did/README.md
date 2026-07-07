# 37 · Difference-in-differences (DiD)

**Question:** policy effect, before/after × treated/control

**Scenario:** Minimum wage: did the 2018 hike change employment relative to non-hike states (parallel pre-trends)?

## Input configuration

- **Dataset:** `minwage-employment.csv`
- **Configure-data overrides:** `year → ordinal`, `treated → nominal`, `post → nominal`
- **Options:** std. errors: clustered; covariates: none; α 0.05; pre-trends F-test (4 pre-period years)

**Role assignments** (drag column → slot):

| Column | Role slot |
|---|---|
| `employment` | outcome |
| `treated` | treatment |
| `post` | period |
| `state` | entity |
| `year` | time |

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
