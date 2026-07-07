# 46 · CB-SEM

**Question:** confirmatory structural model among latent constructs

**Scenario:** Tourism ESG: does environmental attitude strengthen the norm-intention link (moderation, simple-slopes figure)?

## Input configuration

- **Dataset:** `tourism-esg.csv`
- **Configure-data:** app defaults (auto-detected types/levels)
- **Options:** input: construct-slots form (constructs) + AMOS canvas (structural paths + moderation gesture). Paths drawn: esg → intent, norm → intent, service_quality → intent; attitude MODERATES norm → intent (click attitude oval, then the path midpoint). estimator ML; pipeline full (EFA → CFA → fit → structural); bootstrap preset 1,000 (percentile CI, docs-speed preset)

**Measurement model** - constructs defined in the construct-slots form (structural paths drawn on the AMOS canvas; see Options):

| Construct | Items |
|---|---|
| `esg` | esg1–4 |
| `norm` | norm1–4 |
| `service_quality` | service_quality1–4 |
| `attitude` | attitude1–4 (moderator) |
| `intent` | intent1–3 |

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
