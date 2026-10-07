/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AppsScriptProject, ScriptFile } from '../types';

/** How to resolve a file changed on both sides. */
export type ConflictStrategy = 'none' | 'prefer-local' | 'prefer-remote';

export interface MergeResult {
  /** Merged file list (safe content: local wins unless strategy says otherwise). */
  files: ScriptFile[];
  /** Names of files changed on both sides with differing content. */
  conflicts: string[];
}

export interface SyncConflictInfo {
  localProject: AppsScriptProject;
  remoteProject: AppsScriptProject;
  baselineFiles: ScriptFile[] | null;
  conflictedFiles: string[];
}

const byName = (files: ScriptFile[]): Map<string, ScriptFile> =>
  new Map(files.map((f) => [f.name, f]));

/**
 * Three-way merge of local and remote project files against the last synced
 * baseline (the newest git commit). Pure function:
 * - changed on one side only  -> take that side;
 * - changed on both, equal    -> no conflict;
 * - changed on both, differ   -> recorded as conflict (kept as local unless
 *   the strategy prefers remote);
 * - baseline is null          -> remote wins (legacy behaviour, no conflicts).
 */
export const mergeProjectFiles = (
  localFiles: ScriptFile[],
  remoteFiles: ScriptFile[],
  baselineFiles: ScriptFile[] | null,
  strategy: ConflictStrategy = 'none'
): MergeResult => {
  if (!baselineFiles) {
    return { files: remoteFiles, conflicts: [] };
  }

  const local = byName(localFiles);
  const remote = byName(remoteFiles);
  const base = byName(baselineFiles);
  const names = new Set([...local.keys(), ...remote.keys(), ...base.keys()]);
  const conflicts: string[] = [];
  const files: ScriptFile[] = [];

  for (const name of names) {
    const l = local.get(name);
    const r = remote.get(name);
    const b = base.get(name);

    const localChanged = (l?.source ?? null) !== (b?.source ?? null) || !l !== !b;
    const remoteChanged = (r?.source ?? null) !== (b?.source ?? null) || !r !== !b;

    if (l && r && l.source === r.source) {
      files.push(l);
      continue;
    }

    if (localChanged && !remoteChanged) {
      if (l) files.push(l);
      continue;
    }
    if (remoteChanged && !localChanged) {
      if (r) files.push(r);
      continue;
    }
    if (!localChanged && !remoteChanged) {
      if (l) files.push(l);
      continue;
    }

    // Both sides changed differently -> conflict.
    conflicts.push(name);
    if (strategy === 'prefer-remote') {
      if (r) files.push(r);
    } else {
      if (l) files.push(l);
    }
  }

  return { files, conflicts };
};
