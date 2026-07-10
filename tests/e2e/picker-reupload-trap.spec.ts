import { test, expect, type Page } from '@playwright/test'

// Launch-day hotfix regression: replays the OWNER'S EXACT bug journey.
//   upload campus-study.csv -> select+configure+run independent t-test -> back to Upload ->
//   upload causal.csv (entirely different columns) -> at Pick tests the t-test used to render
//   CHECKED and DISABLED (couldn't unselect) -> Confirm used to navigate unconditionally to the
//   stale t-test's now-blocked config ('Blocked: column not found') -> near soft-lock.
// Fix (src/components/screens/PickTestsScreen.tsx + src/state/session.ts firstUnblockedSelection):
//   (1) a SELECTED test's checkbox is only ever disabled for a NEW selection, never for unselecting;
//   (2) Confirm navigates to the first selected test that ISN'T blocked, not selection[0] blindly.

async function dragChip(page: Page, chip: string, roleId: string) {
  // same drag helper as flow.spec.ts — scoped drop-target confirmation + redrag-on-miss under load.
  await expect(async () => {
    const src = page.locator('.chip', { hasText: chip }).first()
    const dst = page.locator(`[data-role="${roleId}"]`)
    await src.scrollIntoViewIfNeeded()
    const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(page.locator(`[data-role="${roleId}"] .chip.assigned`, { hasText: chip })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

test('picker re-upload trap: a blocked selected test stays unselectable-free, and Confirm skips it', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()

  // ── 1. Upload campus-study.csv → select + configure + RUN independent t-test ──
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/campus-study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.locator('.eyebrow').first()).toContainText('Independent t-test')
  await dragChip(page, 'exam_score', 'outcome')
  await dragChip(page, 'gender', 'group')
  await expect(async () => {
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 240_000 })

  // ── 2. Back to Upload, then upload causal.csv — an ENTIRELY DIFFERENT column set ──
  await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: 'Upload' }).click()
  await expect(page.getByRole('heading', { name: 'Upload data' })).toBeVisible()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/causal.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Configure data: keep only educ + score used (the path we'll draw) — everything else off.
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  for (const c of ['id', 'wage', 'educ_iv', 'running_var', 'health', 'enroll', 'exper', 'age', 'ability'])
    await page.getByLabel(`use ${c}`).uncheck()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. THE BUG: the stale, now-ineligible independent t-test must be checked but NOT disabled ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  const staleCheckbox = page.getByRole('checkbox', { name: 'Independent t-test' })
  await expect(staleCheckbox).toBeChecked()
  await expect(staleCheckbox).toBeEnabled() // the greyed-BUT-unselectable trap is gone

  // Unselecting the stale test must actually work (this is the launch-day escape hatch).
  await staleCheckbox.uncheck()
  await expect(staleCheckbox).not.toBeChecked()

  // Select path analysis instead.
  await page.getByRole('checkbox', { name: 'Path analysis' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Confirm must land on path analysis — NOT the stale, now-deselected t-test ──
  await expect(page.locator('.eyebrow').first()).toContainText('Path analysis')
  await expect(page.getByText(/^Blocked:/)).toHaveCount(0)

  // ── 5. Draw educ → score on the path canvas (2 used columns → node 0 = educ, node 1 = score) ──
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(2)
  const rect = (id: number) => page.locator(`rect.sem-node-rect[data-node-id="${id}"]`)
  await rect(0).click()
  await rect(1).click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // ── 6. The config is runnable: Run analysis is enabled, no blocked-config error card. ──
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled()
  await expect(page.getByText(/^Blocked:/)).toHaveCount(0)
})
