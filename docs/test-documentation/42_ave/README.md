# 42 · Average variance extracted (AVE)

**Question:** convergent & discriminant validity of constructs

**Scenario:** Tourism ESG: convergent & discriminant validity across all five constructs.

## Input configuration

- **Dataset:** `tourism-esg.csv`
- **Configure-data:** app defaults (auto-detected types/levels)
- **Options:** estimator: ML (continuous) · WLSMV (ordinal); AVE + CR + ω + α table; Fornell-Larcker matrix; HTMT matrix (all five constructs)

**Constructs** (construct-slots input - name each construct, tick its items):

| Construct | Items |
|---|---|
| `esg` | esg1–4 |
| `norm` | norm1–4 |
| `intent` | intent1–3 |
| `attitude` | attitude1–4 |
| `service_quality` | service_quality1–4 |

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
