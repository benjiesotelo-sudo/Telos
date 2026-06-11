import { test, expect } from '@playwright/test'
test('load sample → run (Welch default) → toggle equal variance → pooled — faithful numbers + export', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByLabel(/Outcome \(DV\)/).selectOption('score')
  await page.getByLabel(/Grouping variable/).selectOption('group')

  // 1) drawn default: equal variance OFF → Welch runs
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Independent t-test' })).toBeVisible({ timeout: 240_000 })
  const t1 = page.locator('#table-group-statistics'), t2 = page.locator('#table-t-test')
  await expect(t1).toContainText('SE')
  await expect(t1).toContainText('70.33'); await expect(t1).toContainText('3.14'); await expect(t1).toContainText('1.28')
  await expect(t1).toContainText('82.33'); await expect(t1).toContainText('3.78'); await expect(t1).toContainText('1.54')
  await expect(t2).toContainText('Mdiff') // M<sub>diff</sub> header text
  await expect(t2).toContainText('−5.98'); await expect(t2).toContainText('9.68') // Welch df, fractional
  await expect(t2).toContainText('<.001'); await expect(t2).toContainText('−12.00')
  await expect(t2).toContainText('[−16.49, −7.51]'); await expect(t2).toContainText('−3.45')

  // 2) toggling the control invalidates the result, re-running gives the pooled row
  await page.getByLabel(/equal variance/).check()
  await expect(t2).toHaveCount(0) // stale result cleared by the config change
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('#table-t-test')).toContainText('10') // integer pooled df
  await expect(page.locator('#table-t-test')).toContainText('[−16.47, −7.53]')

  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download results (.zip)' })).toBeVisible()
})
