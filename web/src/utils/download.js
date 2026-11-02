import { isApp } from '../app/platform.js';

/** @typedef {{ blob: Blob, filename: string }} DownloadFile */

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function anchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';

  document.body.appendChild(a);
  setTimeout(() => {
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 10);
}

// In the native app the share sheet replaces downloads; older app builds without the plugins fall back.
/** @param {DownloadFile[]} files */
async function appDownload(files) {
  try {
    const { shareFiles } = await import('../app/shareFiles.js');
    if (await shareFiles(files)) return;
  } catch (err) {
    console.error('Sharing export failed', err);
    return;
  }
  files.forEach(({ blob, filename }) => anchorDownload(blob, filename));
}

/**
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<void>}
 */
export function downloadBlob(blob, filename) {
  if (isApp) return appDownload([{ blob, filename }]);
  anchorDownload(blob, filename);
  return Promise.resolve();
}

/** @param {unknown} json */
function jsonBlob(json) {
  return new Blob([JSON.stringify(json, undefined, 2)], { type: 'application/json' });
}

/**
 * @param {unknown} json Serialized with JSON.stringify.
 * @param {string} filename
 */
export function downloadJson(json, filename) {
  return downloadBlob(jsonBlob(json), filename);
}

/**
 * @param {{ json: unknown, filename: string }[]} files
 * @param {number} [delayMs]
 */
export async function downloadJsonQueue(files, delayMs = 500) {
  if (isApp) {
    await appDownload(files.map(file => ({ blob: jsonBlob(file.json), filename: file.filename })));
    return;
  }
  for (const [index, file] of files.entries()) {
    downloadJson(file.json, file.filename);
    if (index < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
