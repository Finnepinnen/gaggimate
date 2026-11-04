// Playwright test with a fake device attached to every page. A test fails when the UI or the
// fake device breaks the WebSocket contract, calls an unmocked endpoint or throws an error.
import { test as base, expect } from '@playwright/test';
import { FakeDevice } from './device.js';

export const test = base.extend({
  // auto: every test runs against the fake device, also when it doesn't use it directly.
  device: [
    async ({ page }, provide) => {
      const device = new FakeDevice(page);
      await device.attach();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      await provide(device);

      expect(device.violations, 'contract violations').toEqual([]);
      expect(pageErrors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
