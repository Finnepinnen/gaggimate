import { ExtendedProfileChart } from './ExtendedProfileChart.jsx';

/**
 * ProcessProfileChart extends ExtendedProfileChart to support highlighting the currently active phase
 * during brewing. It automatically determines which phase is currently active based on the process info.
 * @param {object} props
 * @param {{ phases?: import('./ExtendedProfileChart.jsx').ChartPhase[] } | null} [props.data]
 * @param {import('../types').ProcessProgress | null} [props.processInfo]
 * @param {string} [props.className]
 * @param {import('preact').JSX.CSSProperties} [props.style]
 */
export function ProcessProfileChart({
  data,
  processInfo = null,
  className = 'max-h-36 w-full',
  style,
}) {
  // Determine which phase is currently active based on the process info
  const getActivePhaseIndex = () => {
    if (!processInfo || !processInfo.a || !processInfo.l || !data?.phases) {
      return null;
    }

    // Find the phase that matches the current phase label
    const currentPhaseLabel = processInfo.l;

    // Handle the case where processInfo.l might be "Finished"
    if (currentPhaseLabel === 'Finished') {
      return null;
    }

    const activePhaseIndex = data.phases.findIndex(phase => phase.name === currentPhaseLabel);

    return activePhaseIndex >= 0 ? activePhaseIndex : null;
  };

  const activePhaseIndex = getActivePhaseIndex();

  return (
    <ExtendedProfileChart
      data={data}
      className={className}
      style={style}
      selectedPhase={activePhaseIndex}
      showPhaseLabels={false}
    />
  );
}
