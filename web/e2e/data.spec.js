import { test, expect } from './fixtures.js';

test('profile list shows the device profiles by tab', async ({ page }) => {
  await page.goto('/profiles');
  await expect(page.getByText('Default', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Switch to utility tab' }).click();
  await expect(page.getByText('[Utility] Descale', { exact: true })).toBeVisible();
  await expect(page.getByText('[Utility] Backflush', { exact: true })).toBeVisible();
});

test('shot history shows the recorded shot', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByText('Default', { exact: true }).first()).toBeVisible();
});
