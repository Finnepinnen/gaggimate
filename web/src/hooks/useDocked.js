import { useEffect, useState } from 'preact/hooks';

// The sidebar docks from md up or in landscape, otherwise it's an overlay drawer.
const DOCKED_QUERY = '(min-width: 768px), (orientation: landscape)';

export function useDocked() {
  const [docked, setDocked] = useState(
    () => globalThis.window?.matchMedia?.(DOCKED_QUERY).matches ?? true,
  );

  useEffect(() => {
    const mediaQuery = globalThis.window?.matchMedia?.(DOCKED_QUERY);
    if (!mediaQuery) return undefined;
    const handleChange = () => setDocked(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return docked;
}
