/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsScriptProject } from '../types';
import {
  ALL_PROJECTS_KEY,
  CURRENT_PROJECT_KEY,
  flushPersistProjects,
  hasPendingPersist,
  PERSIST_DEBOUNCE_MS,
  persistProjectsNow,
  resetPersistQueue,
  schedulePersistProjects
} from './projectPersistence';

const project = (scriptId: string, source: string): AppsScriptProject => ({
  scriptId,
  title: `Project ${scriptId}`,
  files: [{ name: 'Code', type: 'SERVER_JS', source }]
});

beforeEach(() => {
  localStorage.clear();
  resetPersistQueue();
  vi.useFakeTimers();
});

afterEach(() => {
  resetPersistQueue();
  vi.useRealTimers();
});

describe('persistProjectsNow', () => {
  it('writes both keys synchronously', () => {
    const current = project('p1', 'a');
    persistProjectsNow([current], current);

    expect(JSON.parse(localStorage.getItem(ALL_PROJECTS_KEY)!)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(CURRENT_PROJECT_KEY)!).scriptId).toBe('p1');
    expect(hasPendingPersist()).toBe(false);
  });

  it('drops a queued debounced write', () => {
    const stale = project('stale', 'old');
    schedulePersistProjects([stale], stale);

    const fresh = project('fresh', 'new');
    persistProjectsNow([fresh], fresh);
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS * 2);

    const stored = JSON.parse(localStorage.getItem(ALL_PROJECTS_KEY)!);
    expect(stored.map((p: AppsScriptProject) => p.scriptId)).toEqual(['fresh']);
  });

  it('does not fail when localStorage rejects the write', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => persistProjectsNow([project('p1', 'a')], null)).not.toThrow();
    expect(warn).toHaveBeenCalled();

    spy.mockRestore();
    warn.mockRestore();
  });
});

describe('schedulePersistProjects', () => {
  it('coalesces many edits into a single write', () => {
    const spy = vi.spyOn(localStorage, 'setItem');
    for (let i = 0; i < 25; i++) {
      const current = project('p1', 'x'.repeat(i + 1));
      schedulePersistProjects([current], current);
    }

    expect(spy).not.toHaveBeenCalled();
    expect(hasPendingPersist()).toBe(true);

    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);

    // one write for the project list + one for the current project
    expect(spy).toHaveBeenCalledTimes(2);
    const stored = JSON.parse(localStorage.getItem(CURRENT_PROJECT_KEY)!);
    expect(stored.files[0].source).toHaveLength(25);
    spy.mockRestore();
  });

  it('keeps only the newest snapshot when flushed', () => {
    schedulePersistProjects([project('old', 'a')], project('old', 'a'));
    const latest = project('new', 'b');
    schedulePersistProjects([latest], latest);

    flushPersistProjects();

    expect(JSON.parse(localStorage.getItem(ALL_PROJECTS_KEY)!)[0].scriptId).toBe('new');
    expect(hasPendingPersist()).toBe(false);
  });

  it('keeps writes bounded to one per window while staying fresh', () => {
    const spy = vi.spyOn(localStorage, 'setItem');
    // First edit opens the window; further edits inside it must not extend it.
    schedulePersistProjects([project('p1', 'a')], null);
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS - 50);
    schedulePersistProjects([project('p1', 'ab')], null);
    vi.advanceTimersByTime(50);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toContain('"ab"');

    // A later edit starts a new window.
    schedulePersistProjects([project('p1', 'abc')], null);
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('flushPersistProjects is a no-op when nothing is queued', () => {
    const spy = vi.spyOn(localStorage, 'setItem');
    flushPersistProjects();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
