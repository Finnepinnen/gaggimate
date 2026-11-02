import { i18n } from '../i18n.js';

// Turns `labelMsg` (a msg descriptor) into a `label` getter so consumers always read the active locale.
/**
 * @template {{ labelMsg: import('@lingui/core').MessageDescriptor }} T
 * @param {T} entry
 * @returns {T & { readonly label: string }}
 */
export const withTranslatedLabel = entry => ({
  ...entry,
  get label() {
    return i18n._(entry.labelMsg);
  },
});
