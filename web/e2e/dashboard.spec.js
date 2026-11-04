import { test, expect } from './fixtures.js';
import { recorded } from './device.js';

test.describe('dashboard', () => {
  test('shows the machine in standby', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Machine is ready, wake up to use')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Standby' })).toBeVisible();
  });

  test('switching mode asks the device and follows its state', async ({ page, device }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Brew' }).click();

    await expect
      .poll(() => device.sent('req:change-mode'))
      .toEqual([{ tp: 'req:change-mode', mode: 1 }]);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await expect(page.getByText('Machine is ready, wake up to use')).toBeHidden();
  });

  test('starting a brew shows it running until the device finishes it', async ({
    page,
    device,
  }) => {
    device.state.m = 1;
    await page.goto('/');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect.poll(() => device.sent('req:process:activate').length).toBe(1);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    device.setTelemetry(structuredClone(recorded.finished));
    device.push(recorded.shotFinishedStats);
    await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect.poll(() => device.sent('req:process:clear').length).toBe(1);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});
