# 48 · Path analysis

**Question:** directed-path model among observed variables

## Input configuration

- **Dataset:** `scale.csv`
- **Configure-data overrides:** `x4–x9 → Unused (keep x1, x2, x3)`
- **Options:** input: AMOS canvas (one rectangle per used column; structural paths drawn between observed variables — no measurement model). Model is df = 0 saturated → fit indices suppressed; indirect effect x1 → x2 → x3 with 5000-resample bootstrap (percentile CI); estimator ML

**Path model** — observed-only path mode: one rectangle per used column on the AMOS canvas, structural paths drawn directly between observed variables (no measurement model / no constructs):

| Model element | Value |
|---|---|
| `observed` | x1, x2, x3 |
| `paths` | x1 → x2, x2 → x3, x1 → x3 (single mediator with direct effect) |

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
