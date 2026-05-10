import { test, expect } from '@playwright/test'

async function measureMobileGap(page) {
  const start = page.getByText('Set quote basics').first()
  const next = page.getByText('Build a custom bouquet').first()

  await expect(start).toBeVisible()
  await expect(next).toBeVisible()

  const a = await start.boundingBox()
  const b = await next.boundingBox()

  expect(a).not.toBeNull()
  expect(b).not.toBeNull()

  return b.y - a.y
}

async function assertDesktopStepCardsCompact(page) {
  const cards = page.locator('.step-grid .step-card')
  await expect(cards.first()).toBeVisible()

  const count = await cards.count()
  expect(count).toBeGreaterThanOrEqual(4)

  for (let i = 0; i < Math.min(count, 4); i += 1) {
    const box = await cards.nth(i).boundingBox()
    expect(box).not.toBeNull()
    expect(box.height).toBeLessThan(95)
  }
}

test('spacing is compact on mobile and desktop in sales + operations', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await measureMobileGap(page)).toBeLessThan(230)

  await page.getByRole('button', { name: 'Operations view' }).click()
  expect(await measureMobileGap(page)).toBeLessThan(230)

  await page.getByRole('button', { name: 'Sales view' }).click()
  await page.setViewportSize({ width: 1366, height: 900 })
  await assertDesktopStepCardsCompact(page)

  await page.getByRole('button', { name: 'Operations view' }).click()
  await assertDesktopStepCardsCompact(page)
})
