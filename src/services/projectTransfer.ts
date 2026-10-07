/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import JSZip from 'jszip';
import { AppsScriptProject, ScriptFile } from '../types';
import {
  generateLocalScriptId,
  isGoogleScriptId,
  isLocalScriptId,
  ProjectOrigin
} from './projectOrigin';
import {
  createDefaultManifest,
  fileNameWithExtension,
  isManifestName,
  MANIFEST_NAME,
  scriptFileFromRaw
} from './scriptFileNaming';

/**
 * Import/export of whole projects as plain files:
 *  - ScriptVault JSON bundle (lossless round-trip, single file),
 *  - Google Apps Script `projects.getContent` JSON (`{ "files": [...] }`),
 *  - ZIP archive (folder of `.gs`/`.html`/`.json`),
 *  - loose source files (`.gs`, `.js`, `.html`, `.json`).
 *
 * Everything except the thin `readImportFiles` wrapper is pure and DOM-free so
 * it can be unit-tested.
 */

export const BUNDLE_FORMAT = 'scriptvault-project';
export const BUNDLE_VERSION = 1;

export const MAX_IMPORT_FILES = 300;
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_TOTAL_BYTES = 32 * 1024 * 1024;

export interface ProjectBundle {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: string;
  project: {
    scriptId: string;
    title: string;
    parentId?: string;
    parentTitle?: string;
    origin?: ProjectOrigin;
    files: ScriptFile[];
  };
}

/** One file/folder entry read from disk or from a ZIP archive. */
export interface ImportSource {
  name: string;
  text?: string;
  bytes?: ArrayBuffer | Uint8Array;
}

export interface ImportResult {
  project: AppsScriptProject;
  /** Non-fatal notes for the UI (added manifest, skipped files, dedupe, …). */
  warnings: string[];
  /** Where the project content came from — used for logging/UI copy. */
  sourceKind: 'bundle' | 'content-json' | 'zip' | 'files';
}

const textEncoder = new TextEncoder();

const byteLength = (source: ImportSource): number =>
  source.text !== undefined
    ? textEncoder.encode(source.text).length
    : (source.bytes?.byteLength ?? 0);

const isZipSource = (source: ImportSource): boolean => /\.zip$/i.test(source.name);

const isIgnorableEntry = (name: string): boolean =>
  !name ||
  name.endsWith('/') ||
  name.includes('__MACOSX') ||
  /(^|\/)\.DS_Store$/i.test(name) ||
  /(^|\/)project-metadata\.json$/i.test(name);

const lastPathSegment = (name: string): string => name.split(/[\\/]/).pop() || name;

/** Removes duplicated/blank file names, keeping the first occurrence. */
export const normalizeFiles = (files: ScriptFile[], warnings: string[] = []): ScriptFile[] => {
  const seen = new Set<string>();
  const result: ScriptFile[] = [];
  for (const file of files) {
    const name = file.name.trim();
    if (!name) {
      warnings.push('Пропущен файл с пустым именем.');
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`Файл "${name}" встречается несколько раз — оставлена первая версия.`);
      continue;
    }
    seen.add(key);
    result.push({ name, type: file.type, source: file.source ?? '' });
  }
  return result;
};

const coerceScriptFileType = (value: unknown): ScriptFile['type'] => {
  const type = String(value || '').toUpperCase();
  if (type === 'HTML' || type === 'JSON' || type === 'ENUM' || type === 'SERVER_JS') {
    return type;
  }
  return 'SERVER_JS';
};

const filesFromContentJson = (value: unknown): ScriptFile[] | null => {
  const rawFiles = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { files?: unknown }).files)
      ? ((value as { files: unknown[] }).files as unknown[])
      : null;
  if (!rawFiles) return null;

  const files: ScriptFile[] = [];
  for (const entry of rawFiles) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, source, type } = entry as { name?: unknown; source?: unknown; type?: unknown };
    if (typeof name !== 'string' || typeof source !== 'string') continue;
    files.push({ name, type: coerceScriptFileType(type), source });
  }
  return files.length > 0 ? files : null;
};

const isBundle = (value: unknown): value is ProjectBundle => {
  if (!value || typeof value !== 'object') return false;
  const bundle = value as Partial<ProjectBundle>;
  return (
    bundle.format === BUNDLE_FORMAT &&
    !!bundle.project &&
    typeof bundle.project === 'object' &&
    Array.isArray(bundle.project.files)
  );
};

const parseBundle = (value: ProjectBundle, warnings: string[]): AppsScriptProject => {
  const rawFiles = value.project.files
    .filter((f) => f && typeof f === 'object' && typeof f.name === 'string')
    .map<ScriptFile>((f) => ({
      name: f.name,
      type: coerceScriptFileType(f.type),
      source: typeof f.source === 'string' ? f.source : ''
    }));

  if (rawFiles.length === 0) {
    throw new Error('Бандл проекта не содержит файлов.');
  }

  return finalizeProject(
    {
      scriptId: typeof value.project.scriptId === 'string' ? value.project.scriptId.trim() : '',
      title: typeof value.project.title === 'string' ? value.project.title.trim() : '',
      parentId: value.project.parentId,
      parentTitle: value.project.parentTitle,
      origin: value.project.origin === 'local' ? 'local' : 'cloud',
      files: rawFiles
    },
    warnings
  );
};

const finalizeProject = (
  draft: {
    scriptId: string;
    title: string;
    parentId?: string;
    parentTitle?: string;
    origin?: ProjectOrigin;
    files: ScriptFile[];
  },
  warnings: string[],
  fallbackTitle = 'Импортированный проект'
): AppsScriptProject => {
  let files = normalizeFiles(draft.files, warnings);

  if (!files.some((f) => isManifestName(f.name))) {
    files = [createDefaultManifest(), ...files];
    warnings.push(
      'Манифест appsscript.json отсутствовал — добавлен со значениями по умолчанию (runtime V8, UTC).'
    );
  }

  const keepsId = isGoogleScriptId(draft.scriptId) || isLocalScriptId(draft.scriptId);
  const scriptId = keepsId ? draft.scriptId : generateLocalScriptId();
  const origin: ProjectOrigin =
    isGoogleScriptId(scriptId) && !isLocalScriptId(scriptId) ? (draft.origin ?? 'cloud') : 'local';

  return {
    scriptId,
    title: draft.title || fallbackTitle,
    parentId: draft.parentId,
    parentTitle: draft.parentTitle,
    files,
    origin,
    enabledForSync: true,
    lastSyncStatus: 'idle',
    lastModified: new Date().toISOString()
  };
};

/** Expands ZIP archives into their (text) entries. */
const expandZip = async (
  bytes: ArrayBuffer | Uint8Array,
  archiveName: string,
  warnings: string[]
): Promise<ImportSource[]> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error(`Не удалось прочитать ZIP-архив "${archiveName}" — файл повреждён.`);
  }

  const entries: ImportSource[] = [];
  const names = Object.keys(zip.files).sort();
  for (const name of names) {
    const entry = zip.files[name];
    if (isIgnorableEntry(name) || entry.dir) continue;
    entries.push({ name: lastPathSegment(name), text: await entry.async('string') });
  }
  if (entries.length === 0) {
    warnings.push(`Архив "${archiveName}" пуст.`);
  }
  return entries;
};

/**
 * Parses a set of files (as read from disk) into a ready-to-use project.
 * Accepts any mix of bundles, content JSON, ZIP archives and source files.
 */
export const importSourcesToProject = async (sources: ImportSource[]): Promise<ImportResult> => {
  const warnings: string[] = [];
  let fallbackTitle = '';

  // 1. Unpack archives and drop per-file size bombs before doing anything else.
  const flat: ImportSource[] = [];
  for (const source of sources) {
    if (isZipSource(source)) {
      const bytes = source.bytes ?? (source.text ? textEncoder.encode(source.text) : undefined);
      if (!bytes) throw new Error(`Архив "${source.name}" не содержит данных.`);
      if (!fallbackTitle) fallbackTitle = source.name.replace(/\.zip$/i, '').replace(/[_]+/g, ' ');
      flat.push(...(await expandZip(bytes, source.name, warnings)));
    } else {
      flat.push(source);
    }
  }

  if (flat.length === 0) {
    throw new Error('Не выбрано ни одного файла для импорта.');
  }

  const oversized = flat.filter((s) => byteLength(s) > MAX_IMPORT_FILE_BYTES);
  if (oversized.length > 0) {
    throw new Error(
      `Файл "${oversized[0].name}" больше ${Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)} МБ — импорт отменён.`
    );
  }
  const totalBytes = flat.reduce((acc, s) => acc + byteLength(s), 0);
  if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
    throw new Error('Суммарный размер файлов слишком велик — импорт отменён.');
  }

  // 2. A ScriptVault bundle wins: full round-trip including ids and metadata.
  const bundleSource = flat.find((s) => /\.json$/i.test(s.name) && s.text?.includes(BUNDLE_FORMAT));
  if (bundleSource?.text) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bundleSource.text);
    } catch {
      throw new Error(`Не удалось разобрать JSON бандла "${bundleSource.name}".`);
    }
    if (!isBundle(parsed)) {
      throw new Error(`Файл "${bundleSource.name}" не является бандлом ScriptVault.`);
    }
    const project = parseBundle(parsed, warnings);
    const extras = flat.filter((s) => s !== bundleSource && s.text !== undefined);
    if (extras.length > 0) {
      warnings.push(
        `Бандл уже содержит все файлы — ${extras.length} дополнительный файл(ов) проигнорировано.`
      );
    }
    return { project, warnings, sourceKind: 'bundle' };
  }

  // 3. Otherwise: content JSON files are expanded, everything else is a source file.
  const files: ScriptFile[] = [];
  let sawContentJson = false;

  for (const source of flat) {
    const name = lastPathSegment(source.name);
    const text = source.text ?? '';
    const looksLikeJson = /\.json$/i.test(name) || source.text === undefined;

    if (looksLikeJson && source.text !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      const contentFiles = parsed === undefined ? null : filesFromContentJson(parsed);
      if (contentFiles) {
        sawContentJson = true;
        files.push(...contentFiles);
        continue;
      }
    }

    files.push(scriptFileFromRaw(name, text));
  }

  if (files.length === 0) {
    throw new Error('В выбранных файлах не найден код для импорта.');
  }
  if (files.length > MAX_IMPORT_FILES) {
    throw new Error(`Слишком много файлов (${files.length}), максимум — ${MAX_IMPORT_FILES}.`);
  }

  const project = finalizeProject({ scriptId: '', title: fallbackTitle, files }, warnings);
  return {
    project,
    warnings,
    sourceKind: sawContentJson ? 'content-json' : isZipSource(sources[0]) ? 'zip' : 'files'
  };
};

/** Reads real `File` objects from an `<input type="file">` into import sources. */
export const readImportFiles = async (fileList: FileList | File[]): Promise<ImportSource[]> => {
  const files = Array.from(fileList);
  const sources: ImportSource[] = [];
  for (const file of files) {
    if (isZipSource({ name: file.name })) {
      sources.push({ name: file.name, bytes: await file.arrayBuffer() });
    } else {
      sources.push({ name: file.name, text: await file.text() });
    }
  }
  return sources;
};

/** Convenience wrapper: `FileList` → `AppsScriptProject`. */
export const importProjectFromFiles = async (fileList: FileList | File[]): Promise<ImportResult> =>
  importSourcesToProject(await readImportFiles(fileList));

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Lossless, re-importable single-file project bundle. */
export const buildProjectBundle = (project: AppsScriptProject): string => {
  const bundle: ProjectBundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      scriptId: project.scriptId,
      title: project.title,
      parentId: project.parentId,
      parentTitle: project.parentTitle,
      origin: project.origin === 'local' ? 'local' : 'cloud',
      files: project.files.map((f) => ({ name: f.name, type: f.type, source: f.source }))
    }
  };
  return JSON.stringify(bundle, null, 2);
};

/** Google Apps Script `projects.getContent` payload (drop-in for the REST API). */
export const buildAppsScriptContentJson = (project: AppsScriptProject): string =>
  JSON.stringify(
    {
      scriptId: project.scriptId,
      title: project.title,
      files: project.files.map((f) => ({ name: f.name, type: f.type, source: f.source }))
    },
    null,
    2
  );

/** Project files as real on-disk names (`Code.gs`, `Index.html`, `appsscript.json`). */
export const projectFileEntries = (
  project: AppsScriptProject
): { fileName: string; source: string }[] =>
  project.files.map((file) => ({ fileName: fileNameWithExtension(file), source: file.source }));

/** ZIP archive with the project files plus a small metadata readme. */
export const projectToZipBlob = async (
  project: AppsScriptProject,
  generatedAt: string = new Date().toISOString()
): Promise<Blob> => {
  const zip = new JSZip();
  const folderName = project.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'AppsScript';
  const folder = zip.folder(folderName) || zip;

  projectFileEntries(project).forEach(({ fileName, source }) => {
    folder.file(fileName, source ?? '');
  });

  folder.file(
    'project-metadata.json',
    JSON.stringify(
      {
        scriptId: project.scriptId,
        title: project.title,
        parentId: project.parentId,
        origin: project.origin === 'local' ? 'local' : 'cloud',
        exportedAt: generatedAt,
        filesCount: project.files.length
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: 'blob' });
};

export { MANIFEST_NAME };
