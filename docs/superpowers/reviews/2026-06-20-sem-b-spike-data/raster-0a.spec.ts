import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Spike 0a — prove the annotated path-diagram SVG rasters via html-to-image with the app webfonts.
test('0a: SVG path diagram rasters to a non-blank PNG via html-to-image at DPR 2', async ({ page }) => {
  await page.goto('http://localhost:5173/sem-b-spike/raster-fixture.html')
  await page.evaluate(() => (document as any).fonts.ready)
  await page.click('#raster')
  const img = page.locator('#result')
  await expect(img).toBeVisible({ timeout: 30_000 })

  const { len, w, h, nonBlankRatio, dataUrl } = await page.evaluate(async () => {
    const el = document.getElementById('result') as HTMLImageElement
    const url = el.src
    const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight
    const ctx = c.getContext('2d')!; ctx.drawImage(el, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let nonWhite = 0, total = 0
    for (let i = 0; i < d.length; i += 4) { total++; if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) nonWhite++ }
    return { len: url.length, w: el.naturalWidth, h: el.naturalHeight, nonBlankRatio: nonWhite / total, dataUrl: url }
  })

  // DPR=2 against the 520x~272 diagram node => ~1040px wide raster.
  expect(w).toBeGreaterThan(900)
  // Blue strokes + glyph ink must register; a blank/font-failed raster is ~all white.
  expect(nonBlankRatio).toBeGreaterThan(0.02)

  const outDir = resolve(process.cwd(),
    'docs/superpowers/reviews/2026-06-20-sem-b-spike-data')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, '0a-raster-headless.txt'),
    `len=${len} w=${w} h=${h} nonBlankRatio=${nonBlankRatio.toFixed(4)} dpr=2\n`)
  writeFileSync(resolve(outDir, '0a-raster-headless.png'),
    Buffer.from(dataUrl.split(',')[1], 'base64'))

  console.log(`MEASURED: len=${len} w=${w} h=${h} nonBlankRatio=${nonBlankRatio.toFixed(4)}`)
})
