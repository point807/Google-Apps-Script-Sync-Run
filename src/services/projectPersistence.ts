/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AppsScriptProject } from '../types';

/**
 * localStorage persistence for projects.
 *
 * Every keystroke in the editor calls `updateProject`, and serializing all
 * projects (each holding full file sources) on each character blocked the main
 * thread. Writes are now coalesced: interactive edits are debounced while
 * structural changes (import, project switch, rollback) still write through
 * immediately. A pending write is flushed when the page is hidden/unloaded so
 * no edit is ever lost.
 */

export const ALL_PROJECTS_KEY = 'scriptvault_all_projects';
export const CURRENT_PROJECT_KEY = 'scriptvault_current_project';

export const PERSIST_DEBOUNCE_MS = 400;

interface Snapshot {
  allProjects: AppsScriptProject[];
  currentProject: AppsScriptProject | null;
}

let pending: Snapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

const writeSnapshot = ({ allProjects, currentProject }: Snapshot): void => {
  try {
    localStorage.setItem(ALL_PROJECTS_KEY, JSON.stringify(allProjects));
    if (currentProject) {
      localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(currentProject));
    }
  } catch (e) {
    // Quota exceeded / private mode: editing must keep working regardless.
    console.warn('Failed to save projects', e);
  }
};

const cancelTimer = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
};

/** Writes the snapshot right away, dropping any queued debounced write. */
export const persistProjectsNow = (
  allProjects: AppsScriptProject[],
  currentProject: AppsScriptProject | null
): void => {
  cancelTimer();
  pending = null;
  writeSnapshot({ allProjects, currentProject });
};

/** Queues a write (at most one per PERSIST_DEBOUNCE_MS window). */
export const schedulePersistProjects = (
  allProjects: AppsScriptProject[],
  currentProject: AppsScriptProject | null
): void => {
  pending = { allProjects, currentProject };
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    flushPersistProjects();
  }, PERSIST_DEBOUNCE_MS);
};

/** Writes a queued snapshot immediately (no-op when nothing is queued). */
export const flushPersistProjects = (): void => {
  cancelTimer();
  const snapshot = pending;
  pending = null;
  if (snapshot) writeSnapshot(snapshot);
};

export const hasPendingPersist = (): boolean => pending !== null;

/** Test helper: forgets queued state without writing. */
export const resetPersistQueue = (): void => {
  cancelTimer();
  pending = null;
};

/**
 * Flushes on page hide/unload so a debounced edit cannot be lost when the tab
 * is closed right after typing.
 */
export const bindPersistFlushListeners = (): void => {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('pagehide', flushPersistProjects);
  window.addEventListener('beforeunload', flushPersistProjects);
  // Background tabs can be frozen without a pagehide in some browsers.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersistProjects();
  });
};
