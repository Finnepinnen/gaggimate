import { test, expect } from './fixtures.js';

// Every page loads against the fake device without contract violations, unmocked calls or
// uncaught errors (checked by the device fixture).
const pages = [
  '/',
  '/dashboard-settings',
  '/profiles',
  '/history',
  '/analyzer',
  '/statistics',
  '/settings',
  '/settings/machine',
  '/settings/calibration',
  '/settings/plugins',
  '/settings/bluetooth',
  '/settings/system',
];

for (const path of pages) {
  test(`${path} loads`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });
}
