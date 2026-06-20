# 46 · CB-SEM

**Question:** confirmatory structural model among latent constructs

## Input configuration

- **Dataset:** `scale.csv`
- **Configure-data:** app defaults (auto-detected types/levels)
- **Options:** input: construct-slots form (constructs) + AMOS canvas (structural paths). Paths drawn: visual → textual, textual → speed, visual → speed (mediation). estimator ML; pipeline full (EFA → CFA → fit → structural); bootstrap 5000 (percentile CI)

**Measurement model** — constructs defined in the construct-slots form (structural paths drawn on the AMOS canvas; see Options):

| Construct | Items |
|---|---|
| `visual` | x1, x2, x3 |
| `textual` | x4, x5, x6 |
| `speed` | x7, x8, x9 |

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
