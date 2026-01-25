import { test, expect } from '@playwright/test';

test('brand logo assets load in header', async ({ page }) => {
  await page.goto('/');

  const mark = page.locator('img[src="/brand/logo-mark.svg"]');
  await expect(mark).toHaveCount(1);
  await expect(mark).toBeVisible();
  const markWidth = await mark.evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(markWidth).toBeGreaterThan(0);

  const wordmark = page.locator('img[src="/brand/logo-wordmark.svg"]');
  await expect(wordmark).toHaveCount(1);
  const wordmarkWidth = await wordmark.evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(wordmarkWidth).toBeGreaterThan(0);
});
