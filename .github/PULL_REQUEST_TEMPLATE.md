## What this changes

<!-- One paragraph: the user-visible behavior or the internal property this PR changes, and why. -->

## Gates run

<!-- CI covers typecheck + test:fast + build. Tick what you ran locally beyond that. -->

- [ ] `npm run test:fast`
- [ ] `npm test` (full suite incl. WebR engine + native-R parity) - required if any statistic, runner, or emitter changed
- [ ] `npm run e2e` - required if any screen, flow, or export changed
- [ ] Visual baselines reviewed (`--project=visual`) - required if any pixel changed

## Statistical changes only

- [ ] New/changed values are pinned against native R output (say where the pin lives)
- [ ] The exported `analysis.R` still reproduces the app's numbers (`runs-in-r` suite)
