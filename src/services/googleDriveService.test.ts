/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { parseSnapshotPayload } from './googleDriveService';

const validSnapshot = {
  scriptId: '1abc',
  title: 'My Script',
  parentTitle: 'Table',
  commitId: 'a1b2c3',
  timestamp: '2026-10-07T10:00:00.000Z',
  files: [
    { name: 'Code', type: 'SERVER_JS' as const, source: 'function x() {}' },
    { name: 'Index', type: 'HTML' as const, source: '<html></html>' }
  ]
};

describe('parseSnapshotPayload', () => {
  it('parses a valid snapshot', () => {
    const parsed = parseSnapshotPayload(JSON.stringify(validSnapshot));
    expect(parsed.scriptId).toBe('1abc');
    expect(parsed.files).toHaveLength(2);
    expect(parsed.commitId).toBe('a1b2c3');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseSnapshotPayload('{oops')).toThrow(/JSON/);
  });

  it('rejects non-object payloads', () => {
    expect(() => parseSnapshotPayload('"just a string"')).toThrow();
    expect(() => parseSnapshotPayload('null')).toThrow();
    expect(() => parseSnapshotPayload('42')).toThrow();
  });

  it('rejects payloads without files', () => {
    expect(() => parseSnapshotPayload(JSON.stringify({ scriptId: 'x', title: 't' }))).toThrow(
      /нет файлов/
    );
    expect(() =>
      parseSnapshotPayload(JSON.stringify({ scriptId: 'x', title: 't', files: [] }))
    ).toThrow(/нет файлов/);
  });

  it('rejects files with missing name or source', () => {
    expect(() =>
      parseSnapshotPayload(JSON.stringify({ ...validSnapshot, files: [{ name: 'Code' }] }))
    ).toThrow(/структура/);
    expect(() =>
      parseSnapshotPayload(JSON.stringify({ ...validSnapshot, files: [{ name: 1, source: 'x' }] }))
    ).toThrow(/структура/);
  });

  it('keeps optional metadata undefined when absent', () => {
    const parsed = parseSnapshotPayload(
      JSON.stringify({
        scriptId: 's',
        title: 't',
        files: [{ name: 'A', type: 'SERVER_JS', source: '' }]
      })
    );
    expect(parsed.commitId).toBeUndefined();
    expect(parsed.parentTitle).toBeUndefined();
  });
});
