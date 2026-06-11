import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { utils, write } from 'xlsx'
import { unzipSync } from 'fflate'

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('full journey: welcome → upload → guide → configure → pick → drag → Welch run → toggle → pooled re-run → level back-edit → stale → re-run → zip export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Telos' })).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()

  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible() // clean parse auto-advances
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await expect(page.getByText('12 rows · 2 columns · UTF-8')).toBeVisible()
  await expect(page.getByLabel('level of score')).toHaveValue('ratio')   // suggested level pre-filled
  await expect(page.getByLabel('level of group')).toHaveValue('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await expect(page.getByText('arrives in a later slice').first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Pearson' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  await dragChip(page, 'score', 'outcome')
  await dragChip(page, 'group', 'group')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('score')
  await expect(page.locator('[data-role="group"] .chip.assigned')).toContainText('group')
  await page.getByRole('button', { name: 'Run analysis' }).click()

  // Results — Welch (drawn default: equal variance off)
  const t2 = page.locator('#table-t-test')
  await expect(t2).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('#table-group-statistics')).toContainText('70.33')
  await expect(page.locator('#table-group-statistics')).toContainText('3.78')
  await expect(t2).toContainText('Mdiff')
  await expect(t2).toContainText('−5.98'); await expect(t2).toContainText('9.68')
  await expect(t2).toContainText('<.001'); await expect(t2).toContainText('[−16.49, −7.51]'); await expect(t2).toContainText('−3.45')
  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()

  // Back-edit via the stepper: toggle equal variance → re-run → pooled
  await page.getByRole('button', { name: /t-test/ }).click() // stepper step (accessible name includes the dot glyph)
  await page.getByLabel(/equal variance/).check()
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('#table-t-test')).toContainText('10')            // integer pooled df
  await expect(page.locator('#table-t-test')).toContainText('[−16.47, −7.53]')

  // Back-edit a LEVEL (earlier-step edit) → result goes stale → re-run (spec Testing §3)
  await page.getByRole('button', { name: 'Configure data' }).click()
  await page.getByLabel('level of score').selectOption('interval') // still t-test-compatible: config stays valid, run goes stale
  await page.getByRole('button', { name: 'Results' }).click()      // forward nav via the gates (stepper reads canEnter)
  await expect(page.getByText(/Stale — the configuration changed/)).toBeVisible()
  await page.getByRole('button', { name: 'Run analysis again' }).click()
  await expect(page.getByText(/Stale — the configuration changed/)).toHaveCount(0, { timeout: 120_000 })

  // Disabled export formats asserted (spec Testing §3)
  for (const name of [/PDF report/, /LaTeX file/, /R script/])
    await expect(page.getByRole('checkbox', { name })).toBeDisabled()

  // Zip download with foldered paths (spec Testing §3)
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_independent-t-test/figure_boxplot.png',
    '01_independent-t-test/table_group-statistics.png',
    '01_independent-t-test/table_t-test.png',
  ])
})

test('excel path: multi-sheet workbook → sheet picker → guide', async ({ page }) => {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['group', 'score'], ['a', 1], ['a', 2], ['a', 3], ['b', 4], ['b', 5], ['b', 6]]), 'Data')
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['x'], [1]]), 'Notes')
  const file = join(mkdtempSync(join(tmpdir(), 'telos-')), 'two-sheets.xlsx')
  writeFileSync(file, Buffer.from(write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer))

  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByText('two-sheets.xlsx · 2 sheets')).toBeVisible()
  await page.getByRole('button', { name: 'Use this sheet' }).click()
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
})
