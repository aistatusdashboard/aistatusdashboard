import { test, expect } from '@playwright/test';

test('brand logo renders in header', async ({ page }) => {
  await page.goto('/');

  const mark = page.locator('header img[src="/brand/logo-mark.svg"]');
  await expect(mark).toHaveCount(1);
  await expect(mark).toBeVisible();

  await expect(page.locator('header').getByText('AI Status', { exact: true })).toBeVisible();
});
