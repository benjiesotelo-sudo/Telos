import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

// ── Helpers (shared pattern from anova.spec.ts / association.spec.ts) ─────────

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

async function runAnalysis(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

// ── Journey 1: Cronbach's alpha ───────────────────────────────────────────────
// New machinery exercised: ω-headline reliability table + item-total statistics +
// item-total-correlation figure + 3-file bundle.
// Uses 3 items (min arity=3) set to interval; scale.csv auto-detects as ratio so
// we set x1/x2/x3 to interval in Configure data.

test('Journey: Cronbach\'s alpha — 3-item (interval) scale → T1 ω+α + T2 item-total + figure + 3-file zip', async ({ page }) => {
  // ── 1. Upload ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/scale.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── 2. Configure data: set x1, x2, x3 to interval (Cronbach slot requires ordinal/interval) ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByLabel('level of x1').selectOption('interval')
  await page.getByLabel('level of x2').selectOption('interval')
  await page.getByLabel('level of x3').selectOption('interval')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. Pick test ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: "Cronbach's alpha" }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Configure: drag x1, x2, x3 into items slot ──
  await expect(page.locator('.eyebrow').first()).toContainText("Cronbach's alpha")
  await dragChip(page, 'x1', 'items')
  await expect(page.locator('[data-role="items"]')).toContainText('x1')
  await dragChip(page, 'x2', 'items')
  await expect(page.locator('[data-role="items"]')).toContainText('x2')
  await dragChip(page, 'x3', 'items')
  await expect(page.locator('[data-role="items"]')).toContainText('x3')

  // ── 5. Run ──
  await runAnalysis(page)
  // lavaan + semTools boot is slow — use a generous timeout
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 6. Assert results ──

  // T1: Reliability — ω (McDonald's omega) is the headline coefficient
  const t1 = page.locator('#table-reliability')
  await expect(t1).toBeVisible()
  await expect(t1).toContainText('ω')     // omega column header
  await expect(t1).toContainText('α')     // alpha column header (secondary)
  await expect(t1).toContainText('95% CI')
  await expect(t1).toContainText('3')     // N items = 3
  // ω for a 3-item subset of Holzinger-Swineford; f01 strips leading zero → e.g. ".76"
  // (exact value is stochastic/bootstrap-dependent, so we assert table renders with numeric content)
  await expect(t1).toContainText(/\.\d{2}/)  // e.g. ".76" – at least one .xx value

  // T2: Item-total statistics — drop-item toggle ON by default
  const t2 = page.locator('#table-item-total-statistics')
  await expect(t2).toBeVisible()
  await expect(t2).toContainText('x1')
  await expect(t2).toContainText('x2')
  await expect(t2).toContainText('x3')
  await expect(t2).toContainText('Corrected item-total r')
  await expect(t2).toContainText('α if item dropped')

  // Figure: item-total correlation bar chart (alt = "item-total correlation bar chart — Item contribution")
  await expect(page.getByRole('img', { name: /item.total correlation/i })).toBeVisible()

  // How to read section
  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByText(/McDonald.*omega.*headline/i)).toBeVisible()

  // ── 7. Export + unzip: assert 3-file bundle ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-export.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()
  expect(entries).toContain('01_cronbachs-alpha/table_reliability.png')
  expect(entries).toContain('01_cronbachs-alpha/table_item-total-statistics.png')
  expect(entries).toContain('01_cronbachs-alpha/figure_item-total-correlation.png')
  expect(entries).toHaveLength(3)
})

// ── Journey 2: AVE — construct-slots UI + matrix tables ───────────────────────
// New machinery exercised: constructsInput (ConstructSlots component: + Add construct,
// name text field, item checkboxes), Fornell-Larcker matrix (#table-fornell-larcker),
// HTMT matrix (#table-htmt), 4-file bundle.
// scale.csv auto-detects x1-x9 as ratio → all numeric columns appear in ConstructSlots.

test('Journey: AVE — 2-construct model → T1 convergent validity + Fornell-Larcker matrix + HTMT matrix + 4-file zip', async ({ page }) => {
  // ── 1. Upload (defaults are fine: x1-x9 ratio, all used) ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/scale.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 2. Pick test ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Average variance extracted (AVE)' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 3. Configure: ConstructSlots — add 2 constructs, name them, assign items ──
  await expect(page.locator('.eyebrow').first()).toContainText('Average variance extracted (AVE)')
  // Heading is still "Drag columns into roles" (shared layout); ConstructSlots renders below
  await expect(page.getByText('Add at least 1 construct')).toBeVisible()

  // Add construct 1: "visual" with items x1, x2, x3
  await page.getByRole('button', { name: '+ Add construct' }).click()
  // Scope item checkboxes to the first construct card to avoid strict-mode violations
  // when multiple constructs render the same column names
  const construct1 = page.locator('.card').filter({ has: page.getByLabel('Construct 1 name') })
  await construct1.getByLabel('Construct 1 name').fill('visual')
  await construct1.getByLabel('x1').check()
  await construct1.getByLabel('x2').check()
  await construct1.getByLabel('x3').check()

  // Add construct 2: "memory" with items x7, x8, x9
  await page.getByRole('button', { name: '+ Add construct' }).click()
  const construct2 = page.locator('.card').filter({ has: page.getByLabel('Construct 2 name') })
  await construct2.getByLabel('Construct 2 name').fill('memory')
  await construct2.getByLabel('x7').check()
  await construct2.getByLabel('x8').check()
  await construct2.getByLabel('x9').check()

  // Gate should now be open (each construct has ≥2 items)
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled()

  // ── 4. Run ──
  await runAnalysis(page)
  // lavaan + semTools + bootstrap = very slow; wait for Download to enable as the proxy
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 480_000 })

  // ── 5. Assert results ──

  // T1: Convergent validity — columns: Construct / AVE / CR / ω / α
  const t1 = page.locator('#table-convergent-validity')
  await expect(t1).toBeVisible()
  await expect(t1).toContainText('visual')
  await expect(t1).toContainText('memory')
  await expect(t1).toContainText('AVE')
  await expect(t1).toContainText('CR')
  await expect(t1).toContainText('ω')

  // T2: Fornell-Larcker matrix — diagonal = √AVE (bold), off-diagonal = latent correlations
  const t2 = page.locator('#table-fornell-larcker')
  await expect(t2).toBeVisible()
  await expect(t2).toContainText('visual')
  await expect(t2).toContainText('memory')
  // Diagonal cells hold √AVE values (bold) — assert the matrix has table rows
  await expect(t2.locator('tbody tr')).toHaveCount(2)

  // T3: HTMT matrix — discriminant validity criterion
  const t3 = page.locator('#table-htmt')
  await expect(t3).toBeVisible()
  await expect(t3).toContainText('visual')
  await expect(t3).toContainText('memory')

  // Figure: validity bar chart
  await expect(page.getByRole('img', { name: /validity/i })).toBeVisible()

  // How to read
  await expect(page.getByText('How to read this test')).toBeVisible()

  // ── 6. Export + unzip: assert 4-file bundle ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-export.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()
  expect(entries).toContain('01_ave/table_convergent-validity.png')
  expect(entries).toContain('01_ave/table_fornell-larcker.png')
  expect(entries).toContain('01_ave/table_htmt.png')
  expect(entries).toContain('01_ave/figure_validity.png')
  expect(entries).toHaveLength(4)
})

// ── Journey 3: EFA + scree figure ─────────────────────────────────────────────
// New machinery exercised: suitability table (KMO + Bartlett), variance-explained table,
// scree plot figure (parallel analysis), 5-file bundle.
// EFA accepts ordinal/interval/ratio — scale.csv auto-ratio is fine.

test('Journey: EFA — 9-item scale (ratio) → T1 suitability + T2 variance-explained + scree figure + 5-file zip', async ({ page }) => {
  // ── 1. Upload ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/scale.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 2. Pick test ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Exploratory factor analysis (EFA)' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 3. Configure: drag all 9 items into the items slot ──
  await expect(page.locator('.eyebrow').first()).toContainText('Exploratory factor analysis (EFA)')
  for (const item of ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9']) {
    await dragChip(page, item, 'items')
    await expect(page.locator('[data-role="items"]')).toContainText(item)
  }

  // Default options: retention=parallel, rotation=oblimin, extraction=PAF
  await expect(page.getByLabel('retention')).toHaveValue('parallel')
  await expect(page.getByLabel('rotation')).toHaveValue('oblimin')

  // ── 4. Run ──
  await runAnalysis(page)
  // psych::fa + parallel analysis = slow; wait for Download
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 5. Assert results ──

  // T1: Suitability — KMO + Bartlett
  const t1 = page.locator('#table-suitability')
  await expect(t1).toBeVisible()
  await expect(t1).toContainText('KMO')
  // Holzinger-Swineford KMO is well above .60; f01 strips leading zero → ".759"
  await expect(t1).toContainText(/\.[67]\d/)  // e.g. ".75"
  // Bartlett's test is highly significant (p < .001)
  await expect(t1).toContainText('<.001')

  // T2: Variance explained — at least 1 factor row with an eigenvalue
  const t2 = page.locator('#table-variance-explained')
  await expect(t2).toBeVisible()
  await expect(t2).toContainText('Eigenvalue')
  await expect(t2).toContainText('% variance')
  // Parallel analysis on this dataset retains ≥1 factor; assert at least one variance-explained row
  await expect(t2.locator('tbody tr')).not.toHaveCount(0)

  // T3: Rotated factor loadings — at least one item row
  const t3 = page.locator('#table-rotated-loadings')
  await expect(t3).toBeVisible()
  await expect(t3).toContainText('x1')

  // Figure: scree plot with parallel-analysis overlay
  await expect(page.getByRole('img', { name: /scree/i })).toBeVisible()

  // How to read
  await expect(page.getByText('How to read this test')).toBeVisible()

  // ── 6. Export + unzip: assert 5-file bundle ──
  // (table_interfactor-correlations.png is only present when rotation=oblimin AND phi is non-null;
  //  parallel analysis on this dataset retains ≥2 factors so phi is emitted)
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-export.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()
  // Core 4 always present (suitability, variance, loadings, scree)
  expect(entries).toContain('01_efa/table_suitability.png')
  expect(entries).toContain('01_efa/table_variance-explained.png')
  expect(entries).toContain('01_efa/table_rotated-loadings.png')
  expect(entries).toContain('01_efa/figure_scree.png')
  // The 5th file (interfactor-correlations) is emitted for oblimin when ≥2 factors retained
  // (parallel analysis on 9 Holzinger-Swineford items retains 3 factors — confirmed by native R)
  expect(entries).toContain('01_efa/table_interfactor-correlations.png')
  expect(entries).toHaveLength(5)
})
