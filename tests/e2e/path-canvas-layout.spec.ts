import { test, expect, type Page } from '@playwright/test'
import { placeColumns } from './fixtures/helpers'

// Canvas overflow fix wave (2026-07-11, owner click-through catch): the path card's fixed-height
// wrapper let the shelf paint OVER the Estimation fieldset, the auto-grid parked edge nodes flush
// against the clip edge, the resize handle resized a box nothing respected, and any background
// drag panned the view in every tool mode (shearing edge nodes off-screen mid-draw). These are
// GEOMETRY assertions - the behavioral e2e suite proved counts/text/exports and still missed all
// four, so this spec pins the layout itself. No analysis run - fast, no WebR.

async function openPathCanvas(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/likert5-missing.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: /path analysis/i }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  // Path-mode heading (owner-approved copy, canvas-fix board): no role slots on this card.
  await expect(page.getByRole('heading', { name: 'Build your path model' })).toBeVisible()
}

const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).boundingBox()
  expect(b, `${selector} must be visible`).not.toBeNull()
  return b!
}

// The Estimation fieldset must start BELOW the shelf - the shelf painting over it was the
// headline bug. Checked at two widths: the overlap grew as the shelf wrapped on narrow windows.
for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'narrow', width: 900, height: 800 }]) {
  test(`shelf and nodes stay inside the layout at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await openPathCanvas(page)
    await placeColumns(page, ['b1', 'a1', 'cont1', 'b2'])

    const shelf = await box(page, '.sem-shelf')
    const estimation = await box(page, 'fieldset:has(legend:text("Estimation"))')
    expect(shelf.y + shelf.height, 'Estimation fieldset must start below the shelf').toBeLessThanOrEqual(estimation.y + 1)

    // Every placed node rectangle sits FULLY inside the svg (grid inset - never flush/clipped).
    const svg = await box(page, 'svg[id^="figure-path-diagram"]')
    for (const rect of await page.locator('rect.sem-node-rect').all()) {
      const r = (await rect.boundingBox())!
      expect(r.x, 'node left inside svg').toBeGreaterThan(svg.x)
      expect(r.x + r.width, 'node right inside svg').toBeLessThan(svg.x + svg.width)
      expect(r.y, 'node top inside svg').toBeGreaterThan(svg.y)
      expect(r.y + r.height, 'node bottom inside svg').toBeLessThan(svg.y + svg.height)
    }
  })
}

test('resize handle genuinely resizes the canvas and the layout reflows below it', async ({ page }) => {
  await openPathCanvas(page)
  await placeColumns(page, ['b1', 'a1'])

  const svgBefore = await box(page, 'svg[id^="figure-path-diagram"]')
  const estBefore = await box(page, 'fieldset:has(legend:text("Estimation"))')

  const handle = await box(page, '[aria-label="Resize canvas"]')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 120, { steps: 6 })
  await page.mouse.up()

  const svgAfter = await box(page, 'svg[id^="figure-path-diagram"]')
  expect(svgAfter.height, 'svg grew by the drag distance').toBeGreaterThan(svgBefore.height + 100)

  // The whole column reflows: Estimation moves down by the same growth, shelf stays above it.
  const estAfter = await box(page, 'fieldset:has(legend:text("Estimation"))')
  expect(estAfter.y).toBeGreaterThan(estBefore.y + 100)
  const shelf = await box(page, '.sem-shelf')
  expect(shelf.y + shelf.height).toBeLessThanOrEqual(estAfter.y + 1)
})

test('background drag pans ONLY in Move mode (owner ruling: draw/delete are click-only)', async ({ page }) => {
  await openPathCanvas(page)
  await placeColumns(page, ['b1', 'a1'])

  const svg = page.locator('svg[id^="figure-path-diagram"]')
  await svg.scrollIntoViewIfNeeded()
  const svgBox = await box(page, 'svg[id^="figure-path-diagram"]')
  // A background point: horizontal middle, near the BOTTOM. Near the top the sticky journey rail
  // can sit over the canvas at short viewports and swallow the press (observed: the pan gesture
  // silently hit the rail, passing the no-pan cases vacuously). The bottom strip has no nodes
  // (node bottoms end near mid-height) and stays clear of the corner resize handle.
  const bg = { x: svgBox.x + svgBox.width / 2, y: svgBox.y + svgBox.height - 30 }
  const dragBackground = async () => {
    await page.mouse.move(bg.x, bg.y)
    await page.mouse.down()
    await page.mouse.move(bg.x + 90, bg.y + 40, { steps: 5 })
    await page.mouse.up()
  }

  const vb0 = await svg.getAttribute('viewBox')
  await dragBackground() // default tool is Draw - must NOT pan
  expect(await svg.getAttribute('viewBox'), 'draw-mode background drag must not pan').toBe(vb0)

  await page.getByRole('button', { name: 'Delete' }).click()
  await dragBackground()
  expect(await svg.getAttribute('viewBox'), 'delete-mode background drag must not pan').toBe(vb0)

  await page.getByRole('button', { name: 'Move' }).click()
  await expect(svg).toHaveCSS('cursor', 'grab') // the affordance for the one mode that pans
  await dragBackground()
  expect(await svg.getAttribute('viewBox'), 'move-mode background drag pans').not.toBe(vb0)
})
