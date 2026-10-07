/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppsScriptProject } from '../types';

export interface SearchResult {
  projectId: string;
  projectTitle: string;
  fileName: string;
  fileType: string;
  lineNumber: number; // 1-based
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  previewBefore: string;
  previewAfter: string;
}

const MAX_RESULTS = 200;
const PREVIEW_CHARS = 40;

/**
 * Full-text search across all projects/files.
 * Case-insensitive substring search. Returns at most MAX_RESULTS hits,
 * ordered by project title then file name then line number.
 */
export const searchProjects = (projects: AppsScriptProject[], query: string): SearchResult[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q.length < 2) return []; // avoid noisy single-char searches

  const results: SearchResult[] = [];

  for (const project of projects) {
    for (const file of project.files) {
      const source = file.source || '';
      const lines = source.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        let idx = lower.indexOf(q);
        while (idx !== -1) {
          const before = line.slice(Math.max(0, idx - PREVIEW_CHARS), idx);
          const after = line.slice(idx + q.length, idx + q.length + PREVIEW_CHARS);
          results.push({
            projectId: project.scriptId,
            projectTitle: project.title,
            fileName: file.name,
            fileType: file.type,
            lineNumber: i + 1,
            lineContent: line,
            matchStart: idx,
            matchEnd: idx + q.length,
            previewBefore: before,
            previewAfter: after
          });
          if (results.length >= MAX_RESULTS) return results;
          idx = lower.indexOf(q, idx + q.length);
        }
      }
    }
  }

  // stable sort
  results.sort((a, b) => {
    if (a.projectTitle !== b.projectTitle) return a.projectTitle.localeCompare(b.projectTitle);
    if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
    return a.lineNumber - b.lineNumber;
  });

  return results;
};
