# Web UI tests

Playwright tests that run the web UI against a fake GaggiMate device. No simulator or machine
is needed.

```shell
npm run test:e2e                         # all tests, desktop + mobile viewport
npx playwright test e2e/dashboard.spec.js --project desktop
npx playwright test --ui                 # watch mode with time-travel debugging
```

## How it fits together

- `../../docs/websocket-api.yaml` is the WebSocket contract. `npm run contract:check` makes sure
  it lists every message type the firmware and the web UI use.
- `contract.js` turns the contract (and the `schema/*.json` files it references) into one
  validator per message type.
- `device.js` is the fake device. It serves data recorded from the simulator
  (`fixtures/device/`), answers the common requests the way the firmware does, and checks
  every message in both directions against the contract.
- `fixtures.js` attaches the fake device to every test. A test fails on a contract violation,
  a REST call the fake device doesn't handle, or an uncaught page error.

## Writing a test

```js
import { test, expect } from './fixtures.js';
import { recorded } from './device.js';

test('brewing shows progress', async ({ page, device }) => {
  device.state.m = 1; // brew mode, before the page connects
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => device.sent('req:process:activate').length).toBe(1);
  device.setTelemetry(structuredClone(recorded.finished)); // push device state
});
```

- Find elements by role and accessible name (`getByRole`), not CSS classes.
- Change device state with `device.setState()` (slow state: mode, profile, warnings) and
  `device.setTelemetry()` (temperatures, pressure, process), or `device.push()` any event.
- Assert what the UI sent with `device.sent('req:...')`.
- A new endpoint or request type goes into `device.js`, mirroring the firmware handler.

## Re-recording the device data

Re-record after a firmware change that affects what the device sends. Start the simulator
with fresh state, so the recording is reproducible, then record:

```shell
pio run -e display-sim
mkdir -p .pio/sim-record && cd .pio/sim-record && ../build/display-sim/program   # fresh sim_data/
npm run test:e2e:record                  # in web/, while the simulator runs
```

The recorder pulls one shot and fails if anything the simulator sends doesn't match the
contract. Profile ids are generated, so they change with every recording. To record from a
real machine, pass its URL:
`node scripts/record-device-fixtures.mjs http://gaggimate.local --brew`. Only do that when it
is safe to run a shot. Network credentials are replaced in the recorded settings.
