/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeLineDiff,
  computeProjectDiff,
  createCommit,
  generateCommitSha,
  loadCommits,
  revertToCommit,
  updateCommitSyncStatus,
} from './gitService';
import { ScriptFile } from '../types';

const file = (name: string, source: string): ScriptFile => ({
  name,
  type: 'SERVER_JS',
  source,
});

beforeEach(() => {
  localStorage.clear();
});

describe('generateCommitSha', () => {
  it('returns a hex string of stable short length', () => {
    const sha = generateCommitSha('seed-1');
    expect(sha).toMatch(/^[0-9a-f]+$/);
    expect(sha.length).toBeGreaterThanOrEqual(8);
    expect(sha.length).toBeLessThanOrEqual(10);
  });

  it('produces different ids for the same seed (random suffix)', () => {
    const a = generateCommitSha('same-seed');
    const b = generateCommitSha('same-seed');
    expect(a).not.toBe(b);
  });
});

describe('computeLineDiff', () => {
  it('marks identical lines as same', () => {
    const lines = computeLineDiff('a\nb\nc', 'a\nb\nc');
    expect(lines.every((l) => l.type === 'same')).toBe(true);
    expect(lines).toHaveLength(3);
  });

  it('reports changed lines as del+add', () => {
    const lines = computeLineDiff('a\nb', 'a\nc');
    const types = lines.map((l) => l.type);
    expect(types.filter((t) => t === 'same')).toHaveLength(1);
    expect(types.filter((t) => t === 'del')).toHaveLength(1);
    expect(types.filter((t) => t === 'add')).toHaveLength(1);
  });

  it('handles pure additions and deletions', () => {
    const added = computeLineDiff('', 'x\ny');
    expect(added.every((l) => l.type === 'add')).toBe(true);

    const deleted = computeLineDiff('x\ny', '');
    expect(deleted.every((l) => l.type === 'del')).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(computeLineDiff('', '')).toHaveLength(0);
  });
});

describe('computeProjectDiff', () => {
  it('reports no changes for identical file sets', () => {
    const files = [file('Code', 'function a() {}')];
    const diff = computeProjectDiff(files, files);
    expect(diff.hasChanges).toBe(false);
    expect(diff.filesChanged).toBe(0);
  });

  it('detects modified, added and deleted files', () => {
    const oldFiles = [file('Code', 'function a() {}'), file('Old', 'gone')];
    const newFiles = [file('Code', 'function a() { return 1; }'), file('New', 'hello')];

    const diff = computeProjectDiff(oldFiles, newFiles);
    expect(diff.hasChanges).toBe(true);
    expect(diff.filesChanged).toBe(3);

    const byName = Object.fromEntries(diff.files.map((f) => [f.fileName, f.status]));
    expect(byName['Code']).toBe('modified');
    expect(byName['Old']).toBe('deleted');
    expect(byName['New']).toBe('added');
  });
});

describe('createCommit', () => {
  it('creates the first commit and stores it', () => {
    const commit = createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main');
    expect(commit).not.toBeNull();
    expect(commit!.parentId).toBeUndefined();
    expect(loadCommits('script-1')).toHaveLength(1);
  });

  it('skips commit when nothing changed', () => {
    createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main');
    const second = createCommit('script-1', [file('Code', 'v1')], 'No-op', 'Tester', 'main');
    expect(second).toBeNull();
    expect(loadCommits('script-1')).toHaveLength(1);
  });

  it('links parent and records summary on change', () => {
    const first = createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main');
    const second = createCommit('script-1', [file('Code', 'v2')], 'Update', 'Tester', 'main');
    expect(second!.parentId).toBe(first!.id);
    expect(second!.summary).toBeDefined();
    expect(loadCommits('script-1')[0].id).toBe(second!.id);
  });

  it('creates a commit even without changes when forced', () => {
    createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main');
    const forced = createCommit('script-1', [file('Code', 'v1')], 'Forced', 'Tester', 'main', {
      force: true,
    });
    expect(forced).not.toBeNull();
    expect(loadCommits('script-1')).toHaveLength(2);
  });
});

describe('updateCommitSyncStatus', () => {
  it('updates drive/github sync flags', () => {
    const commit = createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main')!;
    updateCommitSyncStatus('script-1', commit.id, {
      syncedToDrive: true,
      syncedToGitHub: true,
      gitHubCommitSha: 'abc123',
    });
    const stored = loadCommits('script-1')[0];
    expect(stored.syncedToDrive).toBe(true);
    expect(stored.syncedToGitHub).toBe(true);
    expect(stored.gitHubCommitSha).toBe('abc123');
  });
});

describe('revertToCommit', () => {
  it('creates a revert commit restoring target files', () => {
    const first = createCommit('script-1', [file('Code', 'v1')], 'Initial', 'Tester', 'main')!;
    createCommit('script-1', [file('Code', 'v2')], 'Update', 'Tester', 'main');

    const result = revertToCommit('script-1', first.id, 'Tester');
    expect(result).not.toBeNull();
    expect(result!.targetCommit.id).toBe(first.id);
    expect(result!.revertCommit.files[0].source).toBe('v1');
    expect(loadCommits('script-1')).toHaveLength(3);
  });

  it('returns null for unknown commit id', () => {
    expect(revertToCommit('script-1', 'nope')).toBeNull();
  });
});
