// Intentionally themed as a terminal: neutral content stays readable on a
// dark panel across all DaisyUI themes (light/dark/coffee/nord).

/** @typedef {import('./usePumpFlowCalibration.js').CalibrationLog} CalibrationLog */

/** @type {Partial<Record<CalibrationLog['tone'], string>>} */
const LOG_TONE_CLASS = {
  err: 'text-error',
  ok: 'text-success',
  warn: 'text-warning',
};

/** @type {Partial<Record<CalibrationLog['tone'], string>>} */
const LOG_TONE_PREFIX = { err: '✗', ok: '✓', warn: '!' };

/**
 * @param {object} props
 * @param {CalibrationLog[]} props.logs
 */
export default function LogPanel({ logs }) {
  return (
    <div className='bg-neutral text-neutral-content mt-4 max-h-48 overflow-auto rounded-md p-3 font-mono text-xs'>
      {logs.map(l => (
        <div key={l.key} className={LOG_TONE_CLASS[l.tone] || ''}>
          {LOG_TONE_PREFIX[l.tone] || '›'} {l.msg}
        </div>
      ))}
    </div>
  );
}
