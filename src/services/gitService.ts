import { GitCommit, ScriptFile } from '../types';
import { commitsStorage } from './storage';

export interface FileDiff {
  fileName: string;
  fileType: string;
  status: 'added' | 'deleted' | 'modified' | 'unchanged';
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

export interface DiffLine {
  type: 'add' | 'del' | 'same';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ProjectDiff {
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: number;
  hasChanges: boolean;
}

// Generate simple 8-character hex SHA
export const generateCommitSha = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return (hex + rand).slice(0, 10);
};

export const computeLineDiff = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  // Simple LCS / greedy diff algorithm
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      result.push({
        type: 'same',
        content: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1
      });
      i++;
      j++;
    } else {
      // Look ahead for matches
      let foundInNew = -1;
      for (let k = j + 1; k < Math.min(j + 8, newLines.length); k++) {
        if (newLines[k] === oldLines[i]) {
          foundInNew = k;
          break;
        }
      }

      let foundInOld = -1;
      for (let k = i + 1; k < Math.min(i + 8, oldLines.length); k++) {
        if (oldLines[k] === newLines[j]) {
          foundInOld = k;
          break;
        }
      }

      if (foundInNew !== -1 && (foundInOld === -1 || foundInNew - j <= foundInOld - i)) {
        // Add lines up to foundInNew
        while (j < foundInNew) {
          result.push({
            type: 'add',
            content: newLines[j],
            newLineNumber: j + 1
          });
          j++;
        }
      } else if (foundInOld !== -1) {
        // Delete lines up to foundInOld
        while (i < foundInOld) {
          result.push({
            type: 'del',
            content: oldLines[i],
            oldLineNumber: i + 1
          });
          i++;
        }
      } else {
        // Both changed
        result.push({
          type: 'del',
          content: oldLines[i],
          oldLineNumber: i + 1
        });
        result.push({
          type: 'add',
          content: newLines[j],
          newLineNumber: j + 1
        });
        i++;
        j++;
      }
    }
  }

  while (i < oldLines.length) {
    result.push({
      type: 'del',
      content: oldLines[i],
      oldLineNumber: i + 1
    });
    i++;
  }

  while (j < newLines.length) {
    result.push({
      type: 'add',
      content: newLines[j],
      newLineNumber: j + 1
    });
    j++;
  }

  return result;
};

export const computeProjectDiff = (oldFiles: ScriptFile[], newFiles: ScriptFile[]): ProjectDiff => {
  const oldMap = new Map(oldFiles.map((f) => [f.name, f]));
  const newMap = new Map(newFiles.map((f) => [f.name, f]));
  const allNames = Array.from(new Set([...oldMap.keys(), ...newMap.keys()])).sort();

  const fileDiffs: FileDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let filesChanged = 0;

  for (const name of allNames) {
    const oldF = oldMap.get(name);
    const newF = newMap.get(name);

    if (!oldF && newF) {
      // Added
      const lines = computeLineDiff('', newF.source);
      const additions = lines.filter((l) => l.type === 'add').length;
      totalAdditions += additions;
      filesChanged++;
      fileDiffs.push({
        fileName: name,
        fileType: newF.type,
        status: 'added',
        lines,
        additions,
        deletions: 0
      });
    } else if (oldF && !newF) {
      // Deleted
      const lines = computeLineDiff(oldF.source, '');
      const deletions = lines.filter((l) => l.type === 'del').length;
      totalDeletions += deletions;
      filesChanged++;
      fileDiffs.push({
        fileName: name,
        fileType: oldF.type,
        status: 'deleted',
        lines,
        additions: 0,
        deletions
      });
    } else if (oldF && newF) {
      if (oldF.source !== newF.source) {
        const lines = computeLineDiff(oldF.source, newF.source);
        const additions = lines.filter((l) => l.type === 'add').length;
        const deletions = lines.filter((l) => l.type === 'del').length;
        totalAdditions += additions;
        totalDeletions += deletions;
        filesChanged++;
        fileDiffs.push({
          fileName: name,
          fileType: newF.type,
          status: 'modified',
          lines,
          additions,
          deletions
        });
      } else {
        fileDiffs.push({
          fileName: name,
          fileType: newF.type,
          status: 'unchanged',
          lines: [],
          additions: 0,
          deletions: 0
        });
      }
    }
  }

  return {
    files: fileDiffs,
    totalAdditions,
    totalDeletions,
    filesChanged,
    hasChanges: filesChanged > 0
  };
};

// Legacy localStorage key format (pre-IndexedDB builds)
const getLegacyStorageKey = (scriptId: string) => `scriptvault_git_${scriptId}`;

/**
 * One-time migration of commit history from localStorage to IndexedDB.
 * The legacy copy is only removed after it is safely stored (or is garbage).
 */
const migrateLegacyCommits = async (scriptId: string): Promise<void> => {
  const legacyKey = getLegacyStorageKey(scriptId);
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Corrupted legacy commit history, discarding', e);
    localStorage.removeItem(legacyKey);
    return;
  }

  if (Array.isArray(parsed)) {
    try {
      await commitsStorage.set(scriptId, parsed);
      localStorage.removeItem(legacyKey);
    } catch (e) {
      // IndexedDB unavailable — keep the legacy copy so no history is lost
      console.error('Failed to migrate legacy commit history', e);
    }
  } else {
    localStorage.removeItem(legacyKey);
  }
};

export const loadCommits = async (scriptId: string): Promise<GitCommit[]> => {
  try {
    await migrateLegacyCommits(scriptId);
    return (await commitsStorage.get(scriptId)) ?? [];
  } catch (e) {
    console.error('Failed to load commits', e);
    return [];
  }
};

export const saveCommits = async (scriptId: string, commits: GitCommit[]): Promise<void> => {
  try {
    await commitsStorage.set(scriptId, commits);
  } catch (e) {
    console.error('Failed to save commits', e);
  }
};

export const createCommit = async (
  scriptId: string,
  files: ScriptFile[],
  message: string,
  author: string = 'ScriptVault Developer',
  branch: string = 'main',
  options: {
    syncedToDrive?: boolean;
    syncedToGitHub?: boolean;
    gitHubCommitSha?: string;
    force?: boolean;
  } = {}
): Promise<GitCommit | null> => {
  const commits = await loadCommits(scriptId);
  const lastCommit = commits.length > 0 ? commits[0] : null;

  // Check if there are changes compared to last commit
  if (lastCommit && !options.force) {
    const diff = computeProjectDiff(lastCommit.files, files);
    if (!diff.hasChanges) {
      return null; // No changes to commit
    }
  }

  const timestamp = Date.now();
  const seed = `${scriptId}-${timestamp}-${message}-${files.map((f) => f.name + f.source.length).join(',')}`;
  const commitId = generateCommitSha(seed);

  const diffSummary = lastCommit ? computeProjectDiff(lastCommit.files, files) : null;

  const newCommit: GitCommit = {
    id: commitId,
    message,
    author,
    timestamp,
    parentId: lastCommit ? lastCommit.id : undefined,
    branch,
    files: JSON.parse(JSON.stringify(files)),
    summary: diffSummary
      ? {
          filesChanged: diffSummary.filesChanged,
          additions: diffSummary.totalAdditions,
          deletions: diffSummary.totalDeletions
        }
      : {
          filesChanged: files.length,
          additions: files.reduce((acc, f) => acc + f.source.split('\n').length, 0),
          deletions: 0
        },
    syncedToDrive: options.syncedToDrive || false,
    syncedToGitHub: options.syncedToGitHub || false,
    gitHubCommitSha: options.gitHubCommitSha
  };

  const updated = [newCommit, ...commits];
  await saveCommits(scriptId, updated);
  return newCommit;
};

export const updateCommitSyncStatus = async (
  scriptId: string,
  commitId: string,
  updates: { syncedToDrive?: boolean; syncedToGitHub?: boolean; gitHubCommitSha?: string }
): Promise<void> => {
  const commits = await loadCommits(scriptId);
  const idx = commits.findIndex((c) => c.id === commitId);
  if (idx !== -1) {
    commits[idx] = { ...commits[idx], ...updates };
    await saveCommits(scriptId, commits);
  }
};

export const revertToCommit = async (
  scriptId: string,
  commitId: string,
  author: string = 'ScriptVault Developer'
): Promise<{ targetCommit: GitCommit; revertCommit: GitCommit } | null> => {
  const commits = await loadCommits(scriptId);
  const targetCommit = commits.find((c) => c.id === commitId);
  if (!targetCommit) return null;

  const revertCommit = await createCommit(
    scriptId,
    targetCommit.files,
    `Rollback: Revert to commit ${targetCommit.id} ("${targetCommit.message}")`,
    author,
    targetCommit.branch || 'main',
    { force: true }
  );

  if (!revertCommit) return null;
  return { targetCommit, revertCommit };
};
