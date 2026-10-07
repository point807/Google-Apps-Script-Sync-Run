/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Turns any string into a safe file name (keeps letters, digits, `-`, `_`). */
export const safeFileName = (value: string, fallback = 'file'): string =>
  value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '') || fallback;

/** Triggers a browser download for a blob. Shared by every export path. */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick: revoking synchronously can cancel the download in
  // some browsers (Firefox/Safari).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Downloads text (JSON, source code, logs) as a UTF-8 file. */
export const downloadText = (
  text: string,
  fileName: string,
  mimeType = 'text/plain;charset=utf-8'
): void => {
  downloadBlob(new Blob([text], { type: mimeType }), fileName);
};
