# 44 · Exploratory factor analysis (EFA)

**Question:** underlying factors behind a set of items

## Input configuration

- **Dataset:** `scale.csv`
- **Configure-data:** app defaults (auto-detected types/levels)
- **Options:** extraction: PAF; rotation: oblimin; retention: parallel analysis; loadings |< .32| suppressed

**Role assignments** (drag column → slot):

| Column | Role slot |
|---|---|
| `x1` | items |
| `x2` | items |
| `x3` | items |
| `x4` | items |
| `x5` | items |
| `x6` | items |
| `x7` | items |
| `x8` | items |
| `x9` | items |

## Files in this folder

| File | What it is |
|---|---|
| `1-input-config.png` | the configure-test screen with the columns dragged into roles + options set |
| `2-app-output.png` | the rendered results card in the app (APA table, figures, how-to-read, APA sentence) |
| `3-pdf-report.pdf` | the **PDF** export — the app's browser print-to-PDF of this result |
| `4-latex-source.tex` | the **LaTeX** export — the `report.tex` the app generates for this test |
| `5-latex-rendered.pdf` | `4-latex-source.tex` compiled (tectonic / XeTeX) |
| `export/` | the full export bundle: `analysis.R` (reproducible R script), `cleaned.csv`, table/figure PNGs, `LICENSES.txt` |

> The three outputs (app card · PDF · LaTeX) are produced from the same run, so the tables, figures, and numbers should match.
