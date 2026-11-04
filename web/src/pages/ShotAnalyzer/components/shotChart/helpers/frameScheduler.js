/**
 * Runs `callback` on the next animation frame, or after 16 ms where requestAnimationFrame is
 * unavailable.
 * @param {() => void} callback
 * @returns {() => void} Cancels the callback if it has not run yet.
 */
export function scheduleFrame(callback) {
  if (globalThis.requestAnimationFrame) {
    const id = globalThis.requestAnimationFrame(callback);
    return () => globalThis.cancelAnimationFrame(id);
  }
  const id = globalThis.setTimeout(callback, 16);
  return () => globalThis.clearTimeout(id);
}
