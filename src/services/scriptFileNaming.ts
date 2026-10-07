/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { ScriptFile } from '../types';

/**
 * Single source of truth for mapping Apps Script file names/types onto real
 * file names (ZIP export, GitHub push) and back (import from files).
 */

export const MANIFEST_NAME = 'appsscript';

const EXTENSION_BY_TYPE: Record<ScriptFile['type'], string> = {
  SERVER_JS: '.gs',
  HTML: '.html',
  JSON: '.json',
  ENUM: '.gs'
};

/** `.gs` / `.html` / `.json` for a project file (manifest is always `.json`). */
export const extensionForFile = (file: Pick<ScriptFile, 'name' | 'type'>): string =>
  file.name === MANIFEST_NAME ? '.json' : EXTENSION_BY_TYPE[file.type] || '.gs';

/** `Code` → `Code.gs`, `appsscript` → `appsscript.json` (no double extensions). */
export const fileNameWithExtension = (file: Pick<ScriptFile, 'name' | 'type'>): string => {
  const extension = extensionForFile(file);
  return file.name.toLowerCase().endsWith(extension) ? file.name : `${file.name}${extension}`;
};

export const isManifestName = (name: string): boolean =>
  name.toLowerCase().replace(/\.json$/, '') === MANIFEST_NAME;

/** Apps Script file names cannot contain dots, slashes or shell-hostile chars. */
export const appsScriptNameFromFileName = (rawName: string): string => {
  const base = rawName.split(/[\\/]/).pop() || rawName;
  const withoutExtension = base.replace(/\.(gs|js|mjs|html|json|txt)$/i, '');
  const cleaned = withoutExtension
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return cleaned || 'Untitled';
};

/** Script file type inferred from the file extension (unknown → SERVER_JS). */
export const scriptFileTypeFromFileName = (rawName: string): ScriptFile['type'] => {
  const base = (rawName.split(/[\\/]/).pop() || rawName).toLowerCase();
  if (isManifestName(base)) return 'JSON';
  if (base.endsWith('.html') || base.endsWith('.htm')) return 'HTML';
  if (base.endsWith('.json')) return 'JSON';
  return 'SERVER_JS';
};

/** Builds a project file from a raw on-disk file name + its content. */
export const scriptFileFromRaw = (rawName: string, source: string): ScriptFile => ({
  name: appsScriptNameFromFileName(rawName),
  type: scriptFileTypeFromFileName(rawName),
  source
});

/** Default manifest used when imported files carry none (keeps the project pushable). */
export const DEFAULT_MANIFEST_SOURCE = `${JSON.stringify(
  {
    timeZone: 'Etc/UTC',
    dependencies: {},
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8'
  },
  null,
  2
)}\n`;

export const createDefaultManifest = (): ScriptFile => ({
  name: MANIFEST_NAME,
  type: 'JSON',
  source: DEFAULT_MANIFEST_SOURCE
});
