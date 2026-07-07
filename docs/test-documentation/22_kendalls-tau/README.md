# 22 · Kendall's tau

**Question:** rank association, robust to ties

**Scenario:** Campus study: do two motivation-scale items agree (rank concordance)?

## Input configuration

- **Dataset:** `campus-study.csv`
- **Configure-data overrides:** `motivation_1 → ordinal`, `motivation_2 → ordinal`
- **Options:** two-tailed; α 0.05

**Role assignments** (drag column → slot):

| Column | Role slot |
|---|---|
| `motivation_1` | variable A |
| `motivation_2` | variable B |

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
