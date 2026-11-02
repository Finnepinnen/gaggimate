/**
 * @param {Record<string, any> | null | undefined} settings
 * @param {{ dualBoiler?: boolean } | null | undefined} capabilities
 * @returns {boolean}
 */
export function grindAvailable(settings, capabilities) {
  return (
    !!settings?.smartGrindActive ||
    (!capabilities?.dualBoiler && Number(settings?.altRelayFunction ?? 1) === 1)
  );
}
