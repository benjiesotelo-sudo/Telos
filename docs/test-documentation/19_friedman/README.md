# 19 · Friedman

**Question:** nonparametric repeated measures

**Scenario:** Sleep & caffeine: reaction time (skewed) across three doses, same participants.

## Input configuration

- **Dataset:** `sleep-caffeine.csv`
- **Configure-data overrides:** `participant_id → Used + nominal`
- **Options:** Nemenyi post-hoc; α 0.05

**Role assignments** (drag column → slot):

| Column | Role slot |
|---|---|
| `participant_id` | subject |
| `rt_baseline` | measures |
| `rt_low` | measures |
| `rt_high` | measures |

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
