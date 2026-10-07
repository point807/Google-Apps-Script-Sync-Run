/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  AppsScriptProject,
  GitHubConfig,
  ScriptFile,
  SyncLogEntry,
  SyncSettings
} from './types';
import { initAuth, googleSignIn, logout } from './services/firebaseAuth';
import { SAMPLE_SHEETS_SCRIPTS } from './services/sampleScripts';
import { syncCoordinator } from './services/syncManager';
import { createCommit } from './services/gitService';
import { Navbar } from './components/Navbar';
import { SpreadsheetPicker } from './components/SpreadsheetPicker';
import { CodeWorkspace } from './components/CodeWorkspace';
import { GitHistory } from './components/GitHistory';
import { GitHubPanel } from './components/GitHubPanel';
import { BackupDrivePanel } from './components/BackupDrivePanel';
import { ActivityLog } from './components/ActivityLog';
import { ProjectEmptyState } from './components/ProjectEmptyState';

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: false,
  intervalSeconds: 30,
  backupToDrive: true,
  backupToGitHub: true,
  backupFolderName: 'ScriptVault_Backups',
  backupSpreadsheetCopies: true,
  selectedScriptIds: [],
};

const DEFAULT_GITHUB_CONFIG: GitHubConfig = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  path: '',
  autoPush: true,
  connected: false,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [activeTab, setActiveTab] = useState<
    'workspace' | 'sheets' | 'git' | 'github' | 'drive' | 'logs'
  >('workspace');

  // List of all registered projects in the app
  const [allProjects, setAllProjects] = useState<AppsScriptProject[]>(() => {
    try {
      const saved = localStorage.getItem('scriptvault_all_projects');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not parse all_projects', e);
    }
    return [];
  });

  // Currently active project in workspace (null until a project is connected or demo is loaded)
  const [currentProject, setCurrentProject] = useState<AppsScriptProject | null>(() => {
    try {
      const saved = localStorage.getItem('scriptvault_current_project');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not parse saved current project', e);
    }
    return null;
  });

  // Settings
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => {
    try {
      const saved = localStorage.getItem('scriptvault_sync_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.selectedScriptIds) {
          parsed.selectedScriptIds = [];
        }
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SYNC_SETTINGS;
  });

  // GitHub Config
  const [gitHubConfig, setGitHubConfig] = useState<GitHubConfig>(() => {
    try {
      const saved = localStorage.getItem('scriptvault_gh_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_GITHUB_CONFIG;
  });

  // Logs
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);

  // Sync watcher state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [activeScriptsCount, setActiveScriptsCount] = useState<number>(allProjects.length);

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    category: 'drive' | 'github' | 'git' | 'apps_script' | 'realtime' = 'realtime',
    details?: string
  ) => {
    const entry: SyncLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      category,
      message,
      details,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 200)]);
  };

  // 1. Initialize Auth on Mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessToken(token);
        addLog(
          `Вход в Google выполнен: ${authUser.email}`,
          'success',
          'drive'
        );
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );

    // Initial git commit for current project if empty
    allProjects.forEach((proj) => {
      createCommit(
        proj.scriptId,
        proj.files,
        `Initial snapshot of ${proj.title}`,
        'ScriptVault System',
        'main'
      );
    });

    return () => unsubscribe();
  }, []);

  // 2. Setup sync coordinator listeners
  useEffect(() => {
    syncCoordinator.setupListeners(
      (entry) => {
        setLogs((prev) => [entry, ...prev.slice(0, 200)]);
      },
      (status) => {
        setIsSyncing(status.isSyncing);
        if (status.lastSyncedAt) setLastSyncedAt(status.lastSyncedAt);
        setCountdown(status.countdown);
        if (status.activeScriptsCount !== undefined) {
          setActiveScriptsCount(status.activeScriptsCount);
        }
      },
      (updatedProject) => {
        setAllProjects((prev) => {
          const idx = prev.findIndex((p) => p.scriptId === updatedProject.scriptId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updatedProject;
            return next;
          }
          return [updatedProject, ...prev];
        });

        if (updatedProject.scriptId === currentProject?.scriptId) {
          setCurrentProject(updatedProject);
        }
      }
    );
  }, [currentProject?.scriptId]);

  // 3. Start or update auto-sync watcher with multi-script support
  useEffect(() => {
    if (syncSettings.autoSyncEnabled) {
      syncCoordinator.startAutoSync(
        allProjects,
        accessToken,
        syncSettings,
        gitHubConfig
      );
    } else {
      syncCoordinator.stopAutoSync();
    }

    return () => {
      syncCoordinator.stopAutoSync();
    };
  }, [
    allProjects.length,
    accessToken,
    syncSettings.autoSyncEnabled,
    syncSettings.intervalSeconds,
    syncSettings.backupToDrive,
    syncSettings.backupToGitHub,
    syncSettings.backupFolderId,
    syncSettings.backupFolderName,
    syncSettings.selectedScriptIds,
    gitHubConfig.connected,
    gitHubConfig.autoPush,
  ]);

  // Persist all projects
  useEffect(() => {
    try {
      localStorage.setItem('scriptvault_all_projects', JSON.stringify(allProjects));
    } catch (e) {
      console.warn('Failed to save all projects', e);
    }
  }, [allProjects]);

  // Persist current project
  useEffect(() => {
    if (!currentProject) return;
    try {
      localStorage.setItem('scriptvault_current_project', JSON.stringify(currentProject));
    } catch (e) {
      console.warn('Failed to save current project', e);
    }
  }, [currentProject]);

  // Persist settings
  const handleUpdateSettings = (newSettings: SyncSettings) => {
    setSyncSettings(newSettings);
    try {
      localStorage.setItem('scriptvault_sync_settings', JSON.stringify(newSettings));
    } catch (e) {
      // ignore
    }
  };

  // Persist GitHub config
  const handleUpdateGitHubConfig = (newConfig: GitHubConfig) => {
    setGitHubConfig(newConfig);
    try {
      localStorage.setItem('scriptvault_gh_config', JSON.stringify(newConfig));
    } catch (e) {
      // ignore
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        addLog(
          `Вход через Google успешен (${res.user.email})`,
          'success',
          'drive'
        );
      }
    } catch (err: any) {
      addLog(`Ошибка авторизации Google: ${err.message}`, 'error', 'drive');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    addLog('Вы вышли из учетной записи Google', 'info', 'drive');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncCoordinator.runMultiSync(
      allProjects,
      accessToken,
      syncSettings,
      gitHubConfig,
      true
    );
    setIsSyncing(false);
  };

  const handleRestoreVersion = (
    files: ScriptFile[],
    commitMessage: string,
    deployRemotely: boolean = false
  ) => {
    if (!currentProject) return;
    const updated: AppsScriptProject = {
      ...currentProject,
      files,
      lastModified: new Date().toISOString(),
    };
    setCurrentProject(updated);

    // Update in allProjects list
    setAllProjects((prev) =>
      prev.map((p) => (p.scriptId === updated.scriptId ? updated : p))
    );

    // Create a new restore commit in git
    createCommit(
      currentProject.scriptId,
      files,
      commitMessage,
      user?.displayName || 'User Developer',
      'main',
      { force: true }
    );

    addLog(
      `Выполнен откат версии для "${currentProject.title}"${deployRemotely ? ' и отправка в Google Apps Script' : ''}`,
      'success',
      'git'
    );

    setActiveTab('workspace');
  };

  const handleLoadDemo = () => {
    setAllProjects(SAMPLE_SHEETS_SCRIPTS);
    setCurrentProject(SAMPLE_SHEETS_SCRIPTS[0]);
    addLog(
      lang === 'ru'
        ? 'Загружены демо-проекты (данные не являются реальными)'
        : 'Demo projects loaded (data is not real)',
      'info',
      'git'
    );
    setActiveTab('workspace');
  };

  const handleSelectNewProject = (project: AppsScriptProject) => {
    setCurrentProject(project);

    // Add to allProjects if not present
    setAllProjects((prev) => {
      const idx = prev.findIndex((p) => p.scriptId === project.scriptId);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = project;
        return copy;
      }
      return [project, ...prev];
    });

    // Add to selectedScriptIds for sync if not included
    if (syncSettings.selectedScriptIds && !syncSettings.selectedScriptIds.includes(project.scriptId)) {
      handleUpdateSettings({
        ...syncSettings,
        selectedScriptIds: [...syncSettings.selectedScriptIds, project.scriptId],
      });
    }

    createCommit(
      project.scriptId,
      project.files,
      `Imported ${project.title}`,
      'ScriptVault',
      'main'
    );

    setActiveTab('workspace');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600/40">
      {/* Top Navigation */}
      <Navbar
        user={user}
        hasGoogleToken={!!accessToken}
        onGoogleSignIn={handleGoogleSignIn}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        gitHubConnected={gitHubConfig.connected}
        gitHubUsername={gitHubConfig.owner}
        isSyncing={isSyncing}
        countdown={countdown}
        lastSyncedAt={lastSyncedAt}
        activeScriptsCount={
          syncSettings.selectedScriptIds?.length || allProjects.length
        }
        onManualSync={handleManualSync}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'workspace' &&
          (currentProject ? (
            <CodeWorkspace
              project={currentProject}
              onUpdateProject={(updated) => {
                setCurrentProject(updated);
                setAllProjects((prev) =>
                  prev.map((p) => (p.scriptId === updated.scriptId ? updated : p))
                );
              }}
              gitHubConfig={gitHubConfig}
              onUpdateGitHubConfig={handleUpdateGitHubConfig}
              accessToken={accessToken}
              lang={lang}
              onLog={(msg, type) => addLog(msg, type, 'apps_script')}
              onCommitCreated={() => {
                addLog('Коммит зафиксирован вручную', 'success', 'git');
              }}
            />
          ) : (
            <ProjectEmptyState
              lang={lang}
              onLoadDemo={handleLoadDemo}
              onGoConnect={() => setActiveTab('sheets')}
            />
          ))}

        {activeTab === 'sheets' && (
          <SpreadsheetPicker
            accessToken={accessToken}
            currentProject={currentProject}
            onSelectProject={handleSelectNewProject}
            onGoogleSignIn={handleGoogleSignIn}
            lang={lang}
            onLog={(msg, type) => addLog(msg, type, 'drive')}
          />
        )}

        {activeTab === 'git' && (
          <GitHistory
            allProjects={allProjects}
            currentProject={currentProject}
            onSelectProject={(p) => setCurrentProject(p)}
            onRestoreVersion={handleRestoreVersion}
            accessToken={accessToken}
            lang={lang}
            onLog={(msg, type) => addLog(msg, type, 'git')}
          />
        )}

        {activeTab === 'github' && (
          <GitHubPanel
            project={currentProject}
            gitHubConfig={gitHubConfig}
            onUpdateConfig={handleUpdateGitHubConfig}
            lang={lang}
            onLog={(msg, type) => addLog(msg, type, 'github')}
          />
        )}

        {activeTab === 'drive' && (
          <BackupDrivePanel
            allProjects={allProjects}
            accessToken={accessToken}
            settings={syncSettings}
            onUpdateSettings={handleUpdateSettings}
            onTriggerBackupNow={handleManualSync}
            isSyncing={isSyncing}
            lang={lang}
            onLog={(msg, type) => addLog(msg, type, 'drive')}
          />
        )}

        {activeTab === 'logs' && (
          <ActivityLog
            logs={logs}
            onClearLogs={() => setLogs([])}
            lang={lang}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">ScriptVault</span>
            <span>—</span>
            <span>Google Apps Script Sync, Google Drive Backup & GitHub Version Control</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Google Drive API v3</span>
            <span>•</span>
            <span>Google Apps Script REST API v1</span>
            <span>•</span>
            <span>GitHub REST & Git Data API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
