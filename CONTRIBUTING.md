# Contributing to Telos

Thanks for your interest in Telos.
Contributions, bug reports, and questions are all welcome, and they all go through [GitHub Issues](https://github.com/benjiesotelo-sudo/Telos/issues).

## Reporting a problem

Open an issue with:

- What you did (which test, which step of the flow) and what you expected.
- Browser and OS.
- If the problem involves your data: a **minimal synthetic CSV** that reproduces it.
  Telos runs entirely in your browser and never uploads your data, so we cannot see what you saw - please never attach real participant data.
- For a statistics discrepancy: the app's output and, if you have it, the same analysis run in native R (the exported `analysis.R` makes this easy).

## Getting help

Open an issue with the `question` label.
Questions about which statistical test to use are welcome too, though the in-app guidance (Terms guide, "why this test" notes) answers most of them.

## Contributing changes

1. Fork the repo and create a branch.
2. Set up: `npm install`, then `npm run dev` (see README "Commands").
3. Make your change. House rules:
   - The three spec HTMLs (`docs/specs/telos_test_inputs.html`, `docs/specs/telos_test_outputs.html`, `docs/specs/telos_ui_spec.html`) are locked product specs - consistency tests read them verbatim; do not edit them in a code PR.
   - Any change to a statistical routine must keep (or add) a known-answer test whose expected values are verified against native R.
4. Gates before opening a PR - all must be green:
   - `npm run test:fast` (fast inner loop)
   - `npm test` (full suite including the WebR engine tests; slow)
   - `npm run e2e` (Playwright journeys)
   - `npm run build` (includes the TypeScript check)
5. Open a pull request describing what changed and why.

By contributing, you agree that your contributions are licensed under the project's [AGPL-3.0 license](LICENSE).
