import type { Page } from '@playwright/test'

/**
 * Navigate to a specific test card with a CSV fixture pre-loaded.
 * Handles the full upload→guide→configure-data→pick-test→configure-test flow so
 * individual e2e specs can start at the card under test without repeating boilerplate.
 *
 * @param page   Playwright Page
 * @param cardId The test id to select (e.g. 'cb-sem', 'pls-sem')
 * @param csv    Fixture file path relative to the project root (e.g. 'tests/e2e/fixtures/sem.csv')
 */
export async function gotoCard(page: Page, cardId: string, csv: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', `tests/e2e/fixtures/${csv}`)
  // Terms guide
  await page.getByRole('button', { name: 'Continue' }).click()
  // Configure data — accept defaults
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  // Pick test — check the target card
  await page.getByRole('checkbox', { name: new RegExp(cardId, 'i') }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
}
