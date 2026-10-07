/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { mergeProjectFiles } from './syncMerge';
import { ScriptFile } from '../types';

const f = (name: string, source: string): ScriptFile => ({ name, type: 'SERVER_JS', source });

const base = [f('Code', 'base'), f('Util', 'u1'), f('Old', 'o1')];

describe('mergeProjectFiles', () => {
  it('falls back to remote when baseline is missing', () => {
    const local = [f('Code', 'local')];
    const remote = [f('Code', 'remote')];
    const res = mergeProjectFiles(local, remote, null);
    expect(res.files).toEqual(remote);
    expect(res.conflicts).toEqual([]);
  });

  it('takes remote when only remote changed', () => {
    const local = base.map((x) => ({ ...x }));
    const remote = [f('Code', 'remote-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    expect(res.files.find((x) => x.name === 'Code')!.source).toBe('remote-edit');
  });

  it('keeps local when only local changed', () => {
    const local = [f('Code', 'local-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const remote = base.map((x) => ({ ...x }));
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    expect(res.files.find((x) => x.name === 'Code')!.source).toBe('local-edit');
  });

  it('reports conflict and keeps local when both changed differently', () => {
    const local = [f('Code', 'local-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const remote = [f('Code', 'remote-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual(['Code']);
    expect(res.files.find((x) => x.name === 'Code')!.source).toBe('local-edit');
  });

  it('prefer-remote resolves conflicts to remote content', () => {
    const local = [f('Code', 'local-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const remote = [f('Code', 'remote-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const res = mergeProjectFiles(local, remote, base, 'prefer-remote');
    expect(res.conflicts).toEqual(['Code']);
    expect(res.files.find((x) => x.name === 'Code')!.source).toBe('remote-edit');
  });

  it('no conflict when both sides made the same edit', () => {
    const local = [f('Code', 'same'), f('Util', 'u1'), f('Old', 'o1')];
    const remote = [f('Code', 'same'), f('Util', 'u1'), f('Old', 'o1')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    expect(res.files.find((x) => x.name === 'Code')!.source).toBe('same');
  });

  it('handles additions on either side', () => {
    const local = [...base.map((x) => ({ ...x })), f('LocalNew', 'ln')];
    const remote = [...base.map((x) => ({ ...x })), f('RemoteNew', 'rn')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    const names = res.files.map((x) => x.name);
    expect(names).toContain('LocalNew');
    expect(names).toContain('RemoteNew');
  });

  it('same-name additions with different content conflict', () => {
    const local = [...base.map((x) => ({ ...x })), f('New', 'local')];
    const remote = [...base.map((x) => ({ ...x })), f('New', 'remote')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual(['New']);
    expect(res.files.find((x) => x.name === 'New')!.source).toBe('local');
  });

  it('respects deletions: remote deletes untouched local file', () => {
    const local = base.map((x) => ({ ...x }));
    const remote = [f('Code', 'base'), f('Util', 'u1')];
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    expect(res.files.map((x) => x.name)).not.toContain('Old');
  });

  it('local deletion of untouched remote file stays deleted', () => {
    const local = [f('Code', 'base'), f('Util', 'u1')];
    const remote = base.map((x) => ({ ...x }));
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual([]);
    expect(res.files.map((x) => x.name)).not.toContain('Old');
  });

  it('delete on one side vs edit on the other conflicts', () => {
    const local = [f('Code', 'local-edit'), f('Util', 'u1'), f('Old', 'o1')];
    const remote = [f('Util', 'u1'), f('Old', 'o1')]; // Code deleted remotely
    const res = mergeProjectFiles(local, remote, base);
    expect(res.conflicts).toEqual(['Code']);
    // safe default keeps local file
    expect(res.files.map((x) => x.name)).toContain('Code');
  });
});
