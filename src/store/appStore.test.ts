/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsScriptProject } from '../types';
import { ALL_PROJECTS_KEY, CURRENT_PROJECT_KEY } from '../services/projectPersistence';
import { loadCommits } from '../services/gitService';

// The real module throws without Firebase env vars and talks to the network.
vi.mock('../services/firebaseAuth', () => ({
  initAuth: () => () => {},
  googleSignIn: async () => null,
  logout: async () => {}
}));

const { useAppStore } = await import('./appStore');

const project = (scriptId: string, title = 'Imported'): AppsScriptProject => ({
  scriptId,
  title,
  origin: scriptId.startsWith('1LOCAL_') ? 'local' : 'cloud',
  files: [{ name: 'Code', type: 'SERVER_JS', source: 'function a() {}' }]
});

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({
    allProjects: [],
    currentProject: null,
    activeTab: 'sheets',
    activeFileName: 'stale',
    logs: [],
    toasts: [],
    syncSettings: {
      autoSyncEnabled: false,
      intervalSeconds: 30,
      backupToDrive: true,
      backupToGitHub: true,
      backupFolderName: 'ScriptVault_Backups',
      backupSpreadsheetCopies: true,
      selectedScriptIds: []
    }
  });
});

describe('importProject', () => {
  it('adds a new project, selects it and persists it', async () => {
    const imported = project('1LOCAL_abc1234567');
    const result = useAppStore.getState().importProject(imported);

    expect(result.updated).toBe(false);
    const state = useAppStore.getState();
    expect(state.allProjects).toHaveLength(1);
    expect(state.currentProject?.scriptId).toBe(imported.scriptId);
    expect(state.activeTab).toBe('workspace');
    expect(state.activeFileName).toBeNull();
    expect(state.syncSettings.selectedScriptIds).toContain(imported.scriptId);

    expect(JSON.parse(localStorage.getItem(ALL_PROJECTS_KEY)!)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(CURRENT_PROJECT_KEY)!).scriptId).toBe(imported.scriptId);

    // an initial commit is created (force), so the project has history
    await vi.waitFor(async () => {
      expect(await loadCommits(imported.scriptId)).toHaveLength(1);
    });
  });

  it('updates an existing project instead of duplicating it', () => {
    const first = project('1LOCAL_abc1234567');
    useAppStore.getState().importProject(first);

    const changed: AppsScriptProject = {
      ...first,
      title: 'Updated title',
      files: [{ name: 'Code', type: 'SERVER_JS', source: 'function b() {}' }]
    };
    const result = useAppStore.getState().importProject(changed);

    expect(result.updated).toBe(true);
    const state = useAppStore.getState();
    expect(state.allProjects).toHaveLength(1);
    expect(state.currentProject?.title).toBe('Updated title');
    expect(state.currentProject?.files[0].source).toBe('function b() {}');
  });
});

describe('bindScriptId', () => {
  const localId = '1LOCAL_abc1234567';
  const cloudId = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456';

  beforeEach(() => {
    useAppStore.getState().importProject(project(localId));
  });

  it('accepts a bare Script ID and marks the project as bound', () => {
    const result = useAppStore.getState().bindScriptId(cloudId);

    expect(result.ok).toBe(true);
    const state = useAppStore.getState();
    expect(state.currentProject?.scriptId).toBe(cloudId);
    expect(state.currentProject?.origin).toBe('cloud');
    expect(state.syncSettings.selectedScriptIds).toEqual([cloudId]);
    expect(state.allProjects[0].scriptId).toBe(cloudId);
  });

  it('accepts an Apps Script editor URL', () => {
    const result = useAppStore
      .getState()
      .bindScriptId(`https://script.google.com/home/projects/${cloudId}/edit`);
    expect(result.ok).toBe(true);
    expect(useAppStore.getState().currentProject?.scriptId).toBe(cloudId);
  });

  it('rejects empty or malformed ids', () => {
    for (const bad of ['', '   ', 'short', 'not a script id']) {
      const result = useAppStore.getState().bindScriptId(bad);
      expect(result.ok).toBe(false);
    }
    expect(useAppStore.getState().currentProject?.scriptId).toBe(localId);
  });

  it('rejects generated local ids', () => {
    const result = useAppStore.getState().bindScriptId('1LOCAL_zzzz99999999');
    expect(result.ok).toBe(false);
  });
});

describe('updateProject', () => {
  it('coalesces localStorage writes for rapid edits', () => {
    useAppStore.getState().importProject(project('1LOCAL_abc1234567'));
    localStorage.removeItem(ALL_PROJECTS_KEY);

    const setItem = vi.spyOn(localStorage, 'setItem');
    for (let i = 0; i < 10; i++) {
      const current = useAppStore.getState().currentProject!;
      useAppStore.getState().updateProject({
        ...current,
        files: [{ name: 'Code', type: 'SERVER_JS', source: 'x'.repeat(i + 1) }]
      });
    }

    // No synchronous write per keystroke...
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
