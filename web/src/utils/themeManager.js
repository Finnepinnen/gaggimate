import { t } from '@lingui/core/macro';

const THEME_STORAGE_KEY = 'gaggimate-daisyui-theme';
const AVAILABLE_THEMES = ['system', 'light', 'dark', 'coffee', 'nord'];

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function getSystemTheme() {
  return mediaQuery.matches ? 'dark' : 'light';
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored && AVAILABLE_THEMES.includes(stored) ? stored : 'system';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'system';
  }
}

/** @param {string} theme */
export function setStoredTheme(theme) {
  try {
    if (AVAILABLE_THEMES.includes(theme)) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to set stored theme:', error);
    return false;
  }
}

/** @param {string} theme */
export function applyTheme(theme) {
  if (!AVAILABLE_THEMES.includes(theme)) {
    return;
  }
  const actualTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', actualTheme);
}

/**
 * Whether the applied app theme is dark (dark, coffee), as opposed to the OS preference.
 * Reads the `color-scheme` each daisyUI theme declares.
 */
export function isDarkTheme() {
  return getComputedStyle(document.documentElement).colorScheme === 'dark';
}

export function getAvailableThemes() {
  /** @type {Record<string, string>} */
  const labels = {
    system: t({ message: 'System', context: 'theme' }),
    light: t({ message: 'Light', context: 'theme' }),
    dark: t({ message: 'Dark', context: 'theme' }),
    coffee: t({ message: 'Coffee', context: 'theme' }),
  };
  return AVAILABLE_THEMES.map(theme => ({
    value: theme,
    label: labels[theme] ?? theme.charAt(0).toUpperCase() + theme.slice(1),
  }));
}

function onSystemThemeChange() {
  if (getStoredTheme() === 'system') {
    applyTheme('system');
  }
}

// Initialize theme on load
export function initializeTheme() {
  const theme = getStoredTheme();
  mediaQuery.addEventListener('change', onSystemThemeChange);
  applyTheme(theme);
}

// Simple function to handle theme change from select element
/** @param {Event} event Change event of a theme <select>. */
export function handleThemeChange(event) {
  const theme = /** @type {HTMLSelectElement} */ (event.target).value;
  setStoredTheme(theme);
}
