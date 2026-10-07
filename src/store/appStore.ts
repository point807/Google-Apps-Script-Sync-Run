/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import { User } from 'firebase/auth';
import { AppsScriptProject, GitHubConfig, ScriptFile, SyncLogEntry, SyncSettings } from '../types';
import { initAuth, googleSignIn, logout } from '../services/firebaseAuth';
import { SAMPLE_SHEETS_SCRIPTS } from '../services/sampleScripts';
import { syncCoordinator } from '../services/syncManager';
import { loadToken, persistGitHubConfig } from '../services/tokenStore';
import { createCommit } from '../services/gitService';
import { mergeProjectFiles, SyncConflictInfo } from '../services/syncMerge';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
}

export type Lang = 'ru' | 'en';
export type AppTab = 'workspace' | 'sheets' | 'git' | 'github' | 'drive' | 'logs';
export type LogCategory = 'drive' | 'github' | 'git' | 'apps_script' | 'realtime';
export type LogType = 'info' | 'success' | 'warning' | 'error';

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: false,
  intervalSeconds: 30,
  backupToDrive: true,
  backupToGitHub: true,
  backupFolderName: 'ScriptVault_Backups',
  backupSpreadsheetCopies: true,
  selectedScriptIds: []
};

const validateSettings = (parsed: SyncSettings): SyncSettings => ({
  ...DEFAULT_SYNC_SETTINGS,
  ...parsed,
  selectedScriptIds: parsed.selectedScriptIds || []
});

const DEFAULT_GITHUB_CONFIG: GitHubConfig = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  path: '',
  autoPush: true,
  connected: false
};

const loadJson = <T>(key: string, fallback: T, validate?: (value: T) => T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      return validate ? validate(parsed) : parsed;
    }
  } catch (e) {
    console.warn(`Could not parse ${key}`, e);
  }
  return fallback;
};

const INITIAL_SYNC_SETTINGS = loadJson<SyncSettings>(
  'scriptvault_sync_settings',
  DEFAULT_SYNC_SETTINGS,
  validateSettings
);

interface AppStore {
  // --- auth ---
  user: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  initAuthListener: () => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;

  // --- ui ---
  lang: Lang;
  activeTab: AppTab;
  isSearchOpen: boolean;
  setLang: (lang: Lang) => void;
  setActiveTab: (tab: AppTab) => void;
  setSearchOpen: (open: boolean) => void;

  // --- projects ---
  allProjects: AppsScriptProject[];
  currentProject: AppsScriptProject | null;
  activeFileName: string | null;
  selectProject: (project: AppsScriptProject) => void;
  updateProject: (project: AppsScriptProject) => void;
  setActiveFileName: (name: string | null) => void;
  loadDemoProjects: () => void;
  restoreVersion: (files: ScriptFile[], commitMessage: string, deployRemotely?: boolean) => void;
  createInitialCommits: () => void;

  // --- settings ---
  syncSettings: SyncSettings;
  gitHubConfig: GitHubConfig;
  updateSettings: (settings: SyncSettings) => void;
  updateGitHubConfig: (config: GitHubConfig) => void;

  // --- logs & sync status ---
  logs: SyncLogEntry[];
  addLog: (message: string, type?: LogType, category?: LogCategory, details?: string) => void;
  clearLogs: () => void;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  countdown: number;
  activeScriptsCount: number;
  initSyncCoordinator: () => void;
  applyAutoSync: () => void;
  manualSync: () => Promise<void>;
  cancelSync: () => void;
  syncConflict: SyncConflictInfo | null;
  resolveSyncConflict: (prefer: 'local' | 'remote') => void;

  // --- toasts ---
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: number) => void;
}

export const useAppStore = create<AppStore>((set, get) => {
  let toastSeq = 0;

  const pushLogEntry = (entry: SyncLogEntry) => {
    set((state) => ({ logs: [entry, ...state.logs.slice(0, 200)] }));
    if (entry.type === 'error') {
      get().showToast(entry.message, 'error');
    }
  };

  const persistProjects = (
    allProjects: AppsScriptProject[],
    currentProject: AppsScriptProject | null
  ) => {
    try {
      localStorage.setItem('scriptvault_all_projects', JSON.stringify(allProjects));
      if (currentProject) {
        localStorage.setItem('scriptvault_current_project', JSON.stringify(currentProject));
      }
    } catch (e) {
      console.warn('Failed to save projects', e);
    }
  };

  return {
    // --- auth ---
    user: null,
    accessToken: null,
    isLoggingIn: false,

    initAuthListener: () =>
      initAuth(
        (authUser, token) => {
          set({ user: authUser, accessToken: token });
          get().addLog(`Вход в Google выполнен: ${authUser.email}`, 'success', 'drive');
        },
        () => {
          set({ user: null, accessToken: null });
        }
      ),

    signIn: async () => {
      set({ isLoggingIn: true });
      try {
        const res = await googleSignIn();
        if (res) {
          set({ user: res.user, accessToken: res.accessToken });
          get().addLog(`Вход через Google успешен (${res.user.email})`, 'success', 'drive');
        }
      } catch (err: any) {
        get().addLog(`Ошибка авторизации Google: ${err.message}`, 'error', 'drive');
      } finally {
        set({ isLoggingIn: false });
      }
    },

    signOut: async () => {
      await logout();
      set({ user: null, accessToken: null });
      get().addLog('Вы вышли из учетной записи Google', 'info', 'drive');
    },

    // --- ui ---
    lang: 'ru',
    activeTab: 'workspace',
    isSearchOpen: false,
    setLang: (lang) => set({ lang }),
    setActiveTab: (activeTab) => set({ activeTab }),
    setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),

    // --- projects ---
    allProjects: loadJson<AppsScriptProject[]>('scriptvault_all_projects', []),
    currentProject: loadJson<AppsScriptProject | null>('scriptvault_current_project', null),
    activeFileName: null,

    selectProject: (project) => {
      const { allProjects, syncSettings } = get();
      const nextProjects = (() => {
        const idx = allProjects.findIndex((p) => p.scriptId === project.scriptId);
        if (idx !== -1) {
          const copy = [...allProjects];
          copy[idx] = project;
          return copy;
        }
        return [project, ...allProjects];
      })();

      const nextSettings = syncSettings.selectedScriptIds?.includes(project.scriptId)
        ? syncSettings
        : {
            ...syncSettings,
            selectedScriptIds: [...(syncSettings.selectedScriptIds || []), project.scriptId]
          };

      set({
        currentProject: project,
        allProjects: nextProjects,
        syncSettings: nextSettings,
        activeTab: 'workspace',
        activeFileName: null
      });
      persistProjects(nextProjects, project);
      if (nextSettings !== syncSettings) {
        try {
          localStorage.setItem('scriptvault_sync_settings', JSON.stringify(nextSettings));
        } catch {
          // ignore
        }
      }

      void createCommit(
        project.scriptId,
        project.files,
        `Imported ${project.title}`,
        'ScriptVault',
        'main'
      );
    },

    updateProject: (project) => {
      const { allProjects, currentProject } = get();
      const nextProjects = allProjects.map((p) => (p.scriptId === project.scriptId ? project : p));
      const nextCurrent = currentProject?.scriptId === project.scriptId ? project : currentProject;
      set({ allProjects: nextProjects, currentProject: nextCurrent });
      persistProjects(nextProjects, nextCurrent);
    },

    setActiveFileName: (name) => set({ activeFileName: name }),

    loadDemoProjects: () => {
      set({
        allProjects: SAMPLE_SHEETS_SCRIPTS,
        currentProject: SAMPLE_SHEETS_SCRIPTS[0],
        activeTab: 'workspace'
      });
      persistProjects(SAMPLE_SHEETS_SCRIPTS, SAMPLE_SHEETS_SCRIPTS[0]);
      get().addLog(
        get().lang === 'ru'
          ? 'Загружены демо-проекты (данные не являются реальными)'
          : 'Demo projects loaded (data is not real)',
        'info',
        'git'
      );
    },

    restoreVersion: (files, commitMessage, deployRemotely = false) => {
      const { currentProject, user, allProjects } = get();
      if (!currentProject) return;

      const updated: AppsScriptProject = {
        ...currentProject,
        files,
        lastModified: new Date().toISOString()
      };
      const nextProjects = allProjects.map((p) => (p.scriptId === updated.scriptId ? updated : p));
      set({ currentProject: updated, allProjects: nextProjects, activeTab: 'workspace' });
      persistProjects(nextProjects, updated);

      void createCommit(
        currentProject.scriptId,
        files,
        commitMessage,
        user?.displayName || 'User Developer',
        'main',
        {
          force: true
        }
      );

      get().addLog(
        `Выполнен откат версии для "${currentProject.title}"${deployRemotely ? ' и отправка в Google Apps Script' : ''}`,
        'success',
        'git'
      );
    },

    createInitialCommits: () => {
      const { allProjects } = get();
      allProjects.forEach((proj) => {
        void createCommit(
          proj.scriptId,
          proj.files,
          `Initial snapshot of ${proj.title}`,
          'ScriptVault System',
          'main'
        );
      });
    },

    // --- settings ---
    syncSettings: INITIAL_SYNC_SETTINGS,
    gitHubConfig: (() => {
      const base = loadJson<GitHubConfig>(
        'scriptvault_gh_config',
        DEFAULT_GITHUB_CONFIG,
        (parsed) => ({
          ...DEFAULT_GITHUB_CONFIG,
          ...parsed
        })
      );
      const storedToken = loadToken();
      return storedToken ? { ...base, token: storedToken.token } : base;
    })(),

    updateSettings: (settings) => {
      set({
        syncSettings: settings,
        activeScriptsCount: settings.selectedScriptIds?.length || get().allProjects.length
      });
      try {
        localStorage.setItem('scriptvault_sync_settings', JSON.stringify(settings));
      } catch {
        // ignore
      }
    },

    updateGitHubConfig: (config) => {
      set({ gitHubConfig: config });
      persistGitHubConfig(config);
    },

    // --- logs & sync status ---
    logs: [],
    addLog: (message, type = 'info', category = 'realtime', details) => {
      pushLogEntry({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type,
        category,
        message,
        details
      });
    },
    clearLogs: () => set({ logs: [] }),

    isSyncing: false,
    lastSyncedAt: null,
    countdown: 30,
    activeScriptsCount: INITIAL_SYNC_SETTINGS.selectedScriptIds?.length || 0,

    initSyncCoordinator: () => {
      syncCoordinator.setupListeners(
        (entry) => pushLogEntry(entry),
        (status) => {
          set((state) => ({
            isSyncing: status.isSyncing,
            lastSyncedAt: status.lastSyncedAt ?? state.lastSyncedAt,
            countdown: status.countdown,
            activeScriptsCount: status.activeScriptsCount ?? state.activeScriptsCount
          }));
        },
        (updatedProject) => {
          set((state) => {
            const idx = state.allProjects.findIndex((p) => p.scriptId === updatedProject.scriptId);
            const nextProjects =
              idx !== -1
                ? state.allProjects.map((p, i) => (i === idx ? updatedProject : p))
                : [updatedProject, ...state.allProjects];
            return {
              allProjects: nextProjects,
              currentProject:
                updatedProject.scriptId === state.currentProject?.scriptId
                  ? updatedProject
                  : state.currentProject
            };
          });
          persistProjects(get().allProjects, get().currentProject);
        },
        (info) => {
          set({ syncConflict: info });
        }
      );
    },

    applyAutoSync: () => {
      const { allProjects, accessToken, syncSettings, gitHubConfig } = get();
      if (syncSettings.autoSyncEnabled) {
        syncCoordinator.startAutoSync(allProjects, accessToken, syncSettings, gitHubConfig);
      } else {
        syncCoordinator.stopAutoSync();
      }
    },

    manualSync: async () => {
      const { allProjects, accessToken, syncSettings, gitHubConfig } = get();
      set({ isSyncing: true });
      await syncCoordinator.runMultiSync(
        allProjects,
        accessToken,
        syncSettings,
        gitHubConfig,
        true
      );
      set({ isSyncing: false });
    },

    cancelSync: () => {
      syncCoordinator.cancelSync();
    },

    syncConflict: null,

    resolveSyncConflict: (prefer) => {
      const c = get().syncConflict;
      if (!c) return;
      const merge = mergeProjectFiles(
        c.localProject.files,
        c.remoteProject.files,
        c.baselineFiles,
        prefer === 'remote' ? 'prefer-remote' : 'prefer-local'
      );
      const updated: AppsScriptProject = {
        ...c.remoteProject,
        files: merge.files,
        parentTitle: c.localProject.parentTitle,
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'success',
        lastModified: new Date().toISOString()
      };
      const { allProjects, user } = get();
      const idx = allProjects.findIndex((p) => p.scriptId === updated.scriptId);
      const nextProjects =
        idx !== -1
          ? allProjects.map((p, i) => (i === idx ? updated : p))
          : [updated, ...allProjects];
      const nextCurrent =
        get().currentProject?.scriptId === updated.scriptId ? updated : get().currentProject;
      set({ syncConflict: null, allProjects: nextProjects, currentProject: nextCurrent });
      persistProjects(nextProjects, nextCurrent);

      void createCommit(
        updated.scriptId,
        updated.files,
        `Разрешение конфликта синхронизации (${prefer === 'remote' ? 'взяты версии Apps Script' : 'оставлены локальные версии'}): ${c.conflictedFiles.join(', ')}`,
        user?.displayName || 'User Developer',
        'main',
        { force: true }
      );

      get().addLog(
        `Конфликт синхронизации для "${updated.title}" разрешен (${prefer === 'remote' ? 'взяты версии Apps Script' : 'оставлены локальные версии'})`,
        'success',
        'realtime'
      );
    },

    toasts: [],

    showToast: (message, type = 'info') => {
      const id = ++toastSeq;
      set((state) => ({ toasts: [...state.toasts, { id, message, type }].slice(-4) }));
    },

    dismissToast: (id) => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }
  };
});
