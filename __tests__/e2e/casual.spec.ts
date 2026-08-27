import { test, expect } from '@playwright/test';

const appPages = ['/chatgpt', '/claude', '/gemini'];

test('app status pages render without JS and answer the question', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const path of appPages) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/up|down|issues|Checking|verify/i);
  }

  await context.close();
});

test('homepage shows the status board', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('section[aria-label="AI app status board"] a').first()).toBeVisible();

  await context.close();
});
