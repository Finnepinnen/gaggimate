/**
 * /api/settings response: the Settings fields plus machine-profile and setup state
 * (machineProfileBoard, machineProfileCapabilities, setupStep, ...).
 * @typedef {import('../types').Settings & Record<string, any>} SettingsResponse
 */

// Bound the complete response, including JSON decoding. A stalled keep-alive
// connection must not leave settings controls disabled indefinitely.
/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export async function requestJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Could not save or read settings.');
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        options.method?.toUpperCase() === 'POST'
          ? 'The save response timed out. Settings may already be saved; reload to check before retrying.'
          : 'Reading settings timed out. Check the connection and try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET (or POST, with `options`) /api/settings.
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<SettingsResponse>}
 */
export function requestSettings(options = {}, timeoutMs = 10000) {
  return requestJson('/api/settings', options, timeoutMs);
}
