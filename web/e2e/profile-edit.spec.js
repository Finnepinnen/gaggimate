import { test, expect } from './fixtures.js';

// aria-pressed used to get the numeric valve flag (0/1) instead of true/false.
test('standard profile valve buttons report their state', async ({ page }) => {
  await page.goto('/profiles/gp8B2HzGy1');
  const open = page.getByRole('button', { name: 'Valve open' }).first();
  const closed = page.getByRole('button', { name: 'Valve closed' }).first();
  await expect(open).toHaveAttribute('aria-pressed', 'true');
  await expect(closed).toHaveAttribute('aria-pressed', 'false');

  await closed.click();
  await expect(open).toHaveAttribute('aria-pressed', 'false');
  await expect(closed).toHaveAttribute('aria-pressed', 'true');
});

test('pro profile valve buttons report their state', async ({ page }) => {
  await page.goto('/profiles/descale');
  const open = page.getByRole('button', { name: 'Valve open' }).first();
  await expect(open).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Valve closed' }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
