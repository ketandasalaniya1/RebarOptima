import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { openAs } from './qa/session.mjs'

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/users.json', import.meta.url), 'utf8'))
const shots = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../design-qa/screenshots')

function luminance(color) {
  const parts = String(color).match(/[\d.]+/g)?.map(Number) || []
  if (parts.length < 3) return null
  return (parts[0] + parts[1] + parts[2]) / 3
}

test('chat follows the theme and the dashboard layout persists', async ({ page, request }) => {
  test.setTimeout(120_000)
  fs.mkdirSync(shots, { recursive: true })
  await openAs(page, request, fixtures.admin.email, fixtures.password, 'light')

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chat', { waitUntil: 'domcontentloaded' })
  await page.locator('.chat-page-root').waitFor({ state: 'visible', timeout: 8000 })
  const lightBg = await page.locator('.chat-page-root').evaluate((el) => getComputedStyle(el).backgroundColor)
  const lightSide = await page.locator('.chat-sidebar').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(luminance(lightBg)).toBeGreaterThan(200)
  expect(luminance(lightSide)).toBeGreaterThan(200)
  await page.screenshot({ path: path.join(shots, 'chat-light-1440.png') })

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.style.colorScheme = 'dark'
  })
  const darkBg = await page.locator('.chat-page-root').evaluate((el) => getComputedStyle(el).backgroundColor)
  const darkSide = await page.locator('.chat-sidebar').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(luminance(darkBg)).toBeLessThan(40)
  expect(luminance(darkSide)).toBeLessThan(50)
  await page.screenshot({ path: path.join(shots, 'chat-dark-1440.png') })

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.style.colorScheme = 'light'
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(shots, 'chat-light-390.png') })
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(narrow).toBe(false)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Customize Dashboard' }).click()
  await page.getByRole('button', { name: 'Remove' }).first().click()
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('button', { name: 'Customize Dashboard' })).toBeVisible()
  await expect(page.getByText('Live Stock', { exact: true })).toHaveCount(0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Live Stock', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: path.join(shots, 'dashboard-light-1440.png') })

  await page.getByRole('button', { name: 'Customize Dashboard' }).click()
  await page.getByRole('button', { name: 'Reset Dashboard' }).click()
  await expect(page.getByText('Live Stock', { exact: true })).toBeVisible()

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflow, `dashboard ${width}`).toBe(false)
  }
})
