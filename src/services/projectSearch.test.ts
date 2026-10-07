/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { searchProjects } from './projectSearch';
import { AppsScriptProject } from '../types';

const makeProject = (id: string, title: string, files: { name: string; source: string }[]): AppsScriptProject =>
  ({
    scriptId: id,
    title,
    files: files.map((f) => ({
      name: f.name,
      type: 'SERVER_JS' as const,
      source: f.source
    })),
    lastModified: new Date().toISOString()
  }) as AppsScriptProject;

describe('projectSearch', () => {
  it('returns empty for short or empty queries', () => {
    const projects = [makeProject('1', 'P1', [{ name: 'Code', source: 'hello world' }])];
    expect(searchProjects(projects, '')).toEqual([]);
    expect(searchProjects(projects, ' ')).toEqual([]);
    expect(searchProjects(projects, 'a')).toEqual([]);
  });

  it('finds case-insensitive matches with line numbers', () => {
    const projects = [
      makeProject('1', 'My Project', [
        { name: 'Code', source: 'function hello() {\n  Logger.log("Hello World");\n}' }
      ])
    ];
    const results = searchProjects(projects, 'hello');
    expect(results.length).toBe(2);
    expect(results[0].lineNumber).toBe(1);
    expect(results[1].lineNumber).toBe(2);
    expect(results[0].projectTitle).toBe('My Project');
  });

  it('searches across multiple projects and files', () => {
    const projects = [
      makeProject('1', 'A', [{ name: 'Code', source: 'SpreadsheetApp.getActive()' }]),
      makeProject('2', 'B', [{ name: 'Utils', source: 'SpreadsheetApp.openById()' }])
    ];
    const results = searchProjects(projects, 'SpreadsheetApp');
    expect(results.length).toBe(2);
    expect(results.map((r) => r.projectId).sort()).toEqual(['1', '2']);
  });

  it('caps results at MAX_RESULTS', () => {
    const bigSource = Array.from({ length: 300 }, () => 'foo bar').join('\n');
    const projects = [makeProject('1', 'Big', [{ name: 'Code', source: bigSource }])];
    const results = searchProjects(projects, 'foo');
    expect(results.length).toBeLessThanOrEqual(200);
  });

  it('provides preview context', () => {
    const projects = [makeProject('1', 'P', [{ name: 'Code', source: 'const myImportantVariable = 123;' }])];
    const results = searchProjects(projects, 'Important');
    expect(results[0].previewBefore).toContain('my');
    expect(results[0].previewAfter).toContain('Variable');
  });
});
